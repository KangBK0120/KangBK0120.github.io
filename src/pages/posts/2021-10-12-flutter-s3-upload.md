---
layout: ../../layouts/Markdown.astro
title: Flutter에서 S3에 파일 업로드, 다운로드하기
description: "Flutter와 S3 presigned url을 이용해, 컴퓨터나 모바일에 위치한 파일을 S3에 업로드하고 다운로드하는 코드 소개"
category: 개발
pubDate: 2021-10-12
---

# Flutter S3 Upload
<h6 align="right">강병규</h6>

오늘은 Flutter에서 S3 presigned URL을 통해 파일을 업로드하고 다운로드하는 방법을 소개합니다.

## 들어가며

사내에서 간단한 데모 페이지 개발을 위해 Flutter를 사용하게 되었습니다. 주된 기능은 사용자가 파일을 업로드하면 S3에 이 파일을 저장하고 다른 API나 모델에 이 데이터를 전달하는 것입니다. 또한 모델의 결과로 어떤 아웃풋이 나왔을 때 반대로 이를 유저에게 전달해주는 역할도 수행해야 합니다.

따라서 핵심 기능은 다음과 같습니다.

1. 유저가 데이터를 선택할 수 있을 것.
2. 이렇게 선택한 데이터를 서버에 업로드할 것.
3. 결과물을 다운받을 수 있게 할 것.

이 과정에서 S3의 Presigned URL을 사용하였습니다. 이를 이용하면 복잡한 권한 설정없이 설정해준 기간만큼만 해당 URL에 유저가 접근할 수 있게 됩니다. 

업로드의 경우 페이지에서 서버에 업로드에 대한 요청을 보내고, 서버에서는 들어온 요청에 대해 Presigned URL을 생성해 응답을 보냅니다. 이후 페이지에서 다시 응답으로 받은 URL에 데이터를 업로드하게 됩니다. 다운로드의 경우 마찬가지로 페이지가 서버에 다운로드 요청을 보내고, 서버는 해당하는 결과 파일에 대한 주소를 Presigned URL의 형태로 전송해줍니다. 이후 페이지에서는 이 URL에 대한 다운로드를 수행합니다.

여기서는 편의를 위해 미리 생성한 Presigned URL에 데이터를 업로드/다운로드해보도록 하겠습니다.

어떠한 기능도 없는 간단한 화면을 먼저 만들어봅시다. 유저가 파일을 선택할 수 있는 버튼과 선택한 파일의 이름을 보여주는 박스, 그리고 이를 서버로 보내는 버튼으로 이루어진 간단한 화면입니다.

<center><img width="228" alt="스크린샷 2021-10-16 오후 4 12 06-2" src="https://user-images.githubusercontent.com/25279765/137582103-485411a7-90bb-44bb-896a-88ed9a0b5f5b.png"></center>

```dart
class MyHomePage extends StatefulWidget {
  MyHomePage({Key? key, required this.title}) : super(key: key);

  final String title;

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            ElevatedButton(
              onPressed: () {},
              child: Text("Choose a file"),
            ),
            Container(
              decoration: BoxDecoration(
                border: Border.all(
                  width: 1,
                ),
              ),
              width: 350,
              height: 600,
            ),
            ElevatedButton(
              onPressed: () {},
              child: Text("Upload to S3"),
            ),
          ],
        ),
      ),
    );
  }
}
```

## Flutter File Picker

가장 먼저 구현해야할 기능은 유저가 컴퓨터 혹은 모바일에 가지고 있는 데이터를 선택할 수 있게 하는 것입니다. 이를 위해서 [File Picker](https://pub.dev/packages/file_picker)라는 라이브러리를 사용했습니다. 라이브러리에서 지원하는 기능은 크게 1. 파일 하나 고르기 2. 여러 파일 고르기 3. 확장자 필터 기능(개발자가 원하는 확장자만 지정할 수 있습니다) 4. 폴더 선택하기(웹에서는 불가능합니다) 등등이 있습니다.

라이브러리를 설치합시다.

```yaml
dependencies:
  flutter:
    sdk: flutter

  file_picker: ^4.1.4
  cupertino_icons: ^1.0.2
```

이를 import 해줍시다.

```dart
import 'package:file_picker/file_picker.dart';
```

State 내에 지금까지 유저가 선택한 파일들을 저장해주어야 합니다.

```dart
class _MyHomePageState extends State<MyHomePage> {
  final List<PlatformFile> _files = [];
  // build
}
```

그 다음으로 파일을 업로드하는 함수를 짜봅시다. File picker의 pickFiles라는 함수를 이용합니다. 이때 위에서 말한 여러가지 옵션을 줄 수 있습니다. 여기서는 다중 선택만을 허용한 상태로 코드를 작성했습니다. 이렇게 되면 유저는 모든 확장자의 파일을 여러 개 업로드할 수 있습니다. 

함수 내의 변수인 uploadFiles에는 유저가 한 번에 선택한 파일들이 들어있게 됩니다. 이때 유저가 실제로 파일을 업로드하지 않고 창을 닫을 수도 있으므로 이것은 nullable함에 주의해야합니다. 이후 위에서 선언한 멤버 변수에 이 파일들을 계속 추가합니다. 안드로이드나 IOS의 경우에는 유저가 선택하지 않은 경우를 핸들링할 수 있지만 웹의 경우에는 이러한 예외를 처리할 수 없습니다.

```dart
class _MyHomePageState extends State<MyHomePage> {
  final List<PlatformFile> _files = [];

  void _pickFiles() async {
    List<PlatformFile>? uploadedFiles = (await FilePicker.platform.pickFiles(
      allowMultiple: true,
    ))
        ?.files;
    setState(() {
      for (PlatformFile file in uploadedFiles!) {
        _files.add(file);
      }
    });
  }
  // ...
```

이제 버튼을 누르면 이 함수를 실행해야합니다.

```dart
@override
  Widget build(BuildContext context) {
    // ...
            ElevatedButton(
              onPressed: _pickFiles,
              child: Text("Choose a file"),
            ),
    // ...
    }
```

이제 버튼을 눌러보면 파일을 선택할 수 있는 창이 뜨게 됩니다.

<center><img width="849" alt="스크린샷 2021-10-16 오후 4 13 33" src="https://user-images.githubusercontent.com/25279765/137580989-7d41a856-1a32-467f-a4c5-45e346c511f1.png"></center>

이제 유저가 파일을 선택할 때마다 어떤 파일을 선택했는지 확인할 수 있도록 이름을 함께 보여주도록 합시다. 보여지는 크기를 넘어갈 수 있으니 스크롤바와 Listview를 이용합니다. 업로드한 파일이 없는 경우에는 유저가 파일을 업로드해야함을 알 수 있게 문구를 보여줍니다. 또한 유저가 선택한 파일을 업로드하고 싶지 않을 수도 있으니, 삭제 버튼도 추가해주었습니다.

```dart
// Elevated Button
Container(
    decoration: BoxDecoration(
    border: Border.all(
        width: 1,
    ),
    ),
    width: 350,
    height: 500,
    child: Scrollbar(
    isAlwaysShown: true,
    child: ListView.builder(
        itemCount: _files.isEmpty ? 1 : _files.length,
        itemBuilder: (BuildContext context, int index) {
        return _files.isEmpty
            ? const ListTile(
                title:
                    Text("파일을 업로드해주세요 - 한 번에 여러 파일을 업로드할 수 있습니다"))
            : ListTile(
                title: Text(_files.elementAt(index).name),
                trailing: IconButton(
                    icon: const Icon(Icons.delete),
                    onPressed: () {
                    setState(() {
                        _files.removeAt(index);
                    });
                    },
                ),
                );
        },
    ),
    ),
),
// Elevated Button
```

<center><img width="219" alt="스크린샷 2021-10-16 오후 4 18 59-2" src="https://user-images.githubusercontent.com/25279765/137582094-51af8bff-e85d-4f01-876b-34eea4a63e19.png"></center>

<center><img width="211" alt="스크린샷 2021-10-16 오후 4 19 33-2" src="https://user-images.githubusercontent.com/25279765/137582110-20669a10-7e42-48c3-8002-ec3fefb445e4.png"></center>


## Upload to S3 with presigned URL

이제 유저가 파일을 선택하고, 원하지 않는 파일은 삭제할 수 있게 되었습니다. 남은 부분은 이렇게 유저가 선택한 파일을 S3에 업로드하는 것입니다. 여기서는 편의를 위해 미리 생성된 presigned URL에 하나의 파일만을 업로드하도록 하겠습니다. s3 bucket이 없는 경우에는 이를 생성해주세요.

<center><img width="828" alt="스크린샷 2021-10-16 오후 4 25 22" src="https://user-images.githubusercontent.com/25279765/137581009-24e5306f-a17d-4eae-81ea-f291a8310af3.png"></center>

이제 간단한 presigned URL을 생성해봅시다. python으로 생성해보도록 하겠습니다. 업로드의 경우 POST가 아니라 PUT이 된다는 사실에 주의해주세요.

```python
import boto3

url = boto3.client('s3').generate_presigned_url(
    ClientMethod='put_object', 
    Params={'Bucket': 'flutter-filepicker-test', 'Key': 'test.md'},
    ExpiresIn=3600
)

print(url)
```

이를 실행해보면 주소 하나를 얻을 수 있습니다. 이제 이 주소에 파일을 업로드해주면 됩니다. HTTP의 형태로 주고 받으므로 http를 import 해주어야 합니다. 이를 설치하고 import 합시다.

```yaml
dependencies:
  flutter:
    sdk: flutter

  file_picker: ^4.1.4
  cupertino_icons: ^1.0.2
  http: ^0.13.4
```

```dart
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
```

업로드의 경우 간단한 함수로 정의할 수 있습니다. 파일의 byte 값을 이용해 바로 PUT 요청을 전송합니다.

```dart
class _MyHomePageState extends State<MyHomePage> {
  // final List<PlatformFile> _files = [];

  // void _pickFiles()

  Future<int> _uploadToSignedURL(
      {required PlatformFile file, required String url}) async {
    http.Response response = await http.put(Uri.parse(url), body: file.bytes);
    return response.statusCode;
  }
  // ...
  ElevatedButton(
    onPressed: () {
    _uploadToSignedURL(
        file: _files.elementAt(0),
        url: "url-you-have");
    },
    child: Text("Upload to S3"),
  )
}
```

하지만 실제 로컬 크롬 환경에서 PUT 요청을 보내는 경우 CORS 관련 에러가 뜨게 됩니다: No 'Access-Control-Allow-Origin' header is present on the requested resource. 

이를 해결하기 위해서는 S3 bucket에 관련된 속성을 추가해주어야 합니다. 권한-CORS로 이동해 아래를 추가해줍니다.

<center><img width="835" alt="스크린샷 2021-10-16 오후 5 11 48" src="https://user-images.githubusercontent.com/25279765/137581020-1b5cc480-a679-407e-819b-2275ccd8fd8c.png"></center>

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

이후에 크롬의 캐시 데이터를 삭제하고, 다시 버튼을 눌러 요청을 보내주면 정상적으로 업로드가 된 것을 확인할 수 있습니다.

<center><img width="1325" alt="스크린샷 2021-10-16 오후 5 22 20" src="https://user-images.githubusercontent.com/25279765/137581029-b509814c-7d60-4ff1-b165-5bf68fd0ddd7.png"></center>

## Download from S3 with presigned URL

다운로드의 경우도 업로드와 비슷하게 진행하면 됩니다. put_object 대신 get_object로 바꿔주고, 얻은 URL에서 http.get을 이용하면 됩니다.

```python
import boto3

url = boto3.client('s3').generate_presigned_url(
    ClientMethod='get_object', 
    Params={'Bucket': 'flutter-filepicker-test', 'Key': 'test.md'},
    ExpiresIn=3600
)

print(url)
```

비슷한 URL을 얻을 수 있습니다. 테스트를 위해 간단한 버튼을 화면에 추가해줍시다.

```dart
// ElevatedButton for upload
ElevatedButton(
    onPressed: () {},
    child: Text("Download S3"),
)
```

앞에서 얻은 URL에 대해 http.get을 시도해봅시다.

```dart
// _uploadToSignedURL
void _downloadFromSignedURL({required String url}) async {
    await http.get(Uri.parse(url));
}
// build
// ...
    ElevatedButton(
        onPressed: () {
            _downloadFromSignedURL(url: "url-you-have");
        },
        child: Text("Download S3"),
    )
// ...
```

하지만 버튼을 눌러봐도 아무 반응이 없다는 사실을 알 수 있습니다. http get을 이용해 이것의 응답을 가져올 수는 있지만, 아직 유저가 다운로드할 수 있는 형태가 아닙니다. 이를 해결하기 위해 간단한 html 로직을 추가해줍시다. 먼저 import를 해줍시다.

```dart
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:html' as html;
```

버튼도 html을 이용해 다운로드 받을 수 있게 바꿔 줍시다.

```dart
ElevatedButton(
    onPressed: () {
    html.AnchorElement anchorElem = html.AnchorElement(href: "url-you-have");
    anchorElem.download = "url-you-have";
    anchorElem.click();
    },
    child: Text("Download from S3"),
)
```

이제 버튼을 클릭해보면 정상적으로 다운로드가 이루어집니다.

## 정리

오늘은 Flutter를 이용해 사용자가 파일을 선택하고, S3에 업로드, 다운로드하는 방법을 알아보았습니다. 이 과정에서 S3에 별도 권한을 설정해주는 대신 presigned URL을 이용하여 http 통신만으로 이를 수행하였습니다. 이때 presigned URL의 경우에는 이 URL을 가지고 있는 모든 사람이 접근이 가능하므로, 유출되지 않도록 주의하여야 합니다.