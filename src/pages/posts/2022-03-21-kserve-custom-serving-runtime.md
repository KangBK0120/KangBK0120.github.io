---
layout: ../../layouts/Markdown.astro
title: kserve custom serving runtime 사용하기
description: "kserve에서 serving runtime을 이용해 커스텀 환경 사용하기"
category: 개발
pubDate: 2022-03-21
---

# KSERVE CUSTOM SERVING RUNTIME

요즈음 kserve를 사용해보고 있는데 이전 글에도 언급했던 것처럼 문서에 약간 부족한 부분이 많다. 파편화되어 있어 관련 정보가 이곳저곳에 산재한 경우도 있고, 애초에 빠져있는 경우도 있다. 특히 여기서 정리하는 serving runtime은 한참 헤맸다. 마찬가지로 누군가를 위해 간단하게 정리해본다.

## SERVING RUNTIME

기본적으로 귀찮은 일은 KSERVE가 진행해주니까 유저가 서빙 환경을 위해 이미지를 관리해야 할 필요는 없다. 정말로 모델의 URI만을 넘겨주면 배포를 알아서 다해주니까.

근데 어떤 문제로 인해 이 일을 직접 해야 할 경우가 생기기 마련이다. 패키지의 버전이 달라 모델이 안 돌아간다거나 모델 학습을 3.8 이상의 환경에서 진행해 `unsupported pickle protocol 5`라는 에러를 볼 수도 있고... 후자의 경우 기본으로 배포된 이미지는 파이썬 3.7을 사용하고 새로운 pickle protocol은 3.8+에서 적용되어 있으므로 파이썬 버전을 업데이트해줘야 한다. 하지만 말은 쉽지 파이썬 버전을 바꿔주려면 결국 새로운 이미지를 빌드하고 배포해야 한다는 얘기가 되겠다. 학습 환경을 낮춰서 해결할 수도 있겠지만 학습을 내가 하지 않는다면 별 다른 선택지가 없다.

## Build

우선 사용할 환경을 먼저 빌드해야한다. 우리는 서빙 환경에서 사용하는 이미지와 설치되는 패키지 정도만을 건드릴 예정이므로 코드는 손대지 않는다. [공식 레포](https://github.com/kserve/kserve)를 클론해서 시작하자. python 폴더로 들어가 보면 사용하는 explainer와 server 등의 코드가 존재하는 것을 확인할 수 있다. 여기서는 scikit learn의 베이스 파이썬 버전만을 수정해보겠다.

sklearn.Dockerfile을 열어보자.

```dockerfile
# 이전
FROM python:3.7-slim 

# 이후
FROM python:3.8-slim
```

만약 패키지 버전을 바꿔야 하거나 패키지 추가 설치가 필요한 경우라면 해당 서버의 setup.py(여기서는 `sklearnserver/setup.py`가 될 것이다)를 수정해야할 수도 있다. 이제 도커 이미지를 빌드하고 이를 레지스트리에 푸시해보자. `kserve/python`에서 실행해야한다.

```bash
docker build -t {user}/{repo}:tag -f sklearn.Dockerfile .

docker push {user}/{repo}:tag
```

## Document

이제 이렇게 빌드한 이미지를 이용해 모델을 배포해야 한다. 우선 [공식 문서](https://kserve.github.io/website/0.8/modelserving/v1beta1/lightgbm/#run-lightgbm-inferenceservice-with-your-own-image)에서부터 한 번 출발해보자. 애초에 왜 이 정보가 lightgbm에만 있는지도 모르겠다(다른 서비스, Tensorflow나 scikit-learn, xgboost 등등에는 없다). 게다가 `following this instruction`이라는데 링크가 망가져 있다(아마 공식 레포의 [이 부분](https://github.com/kserve/kserve/tree/master/python/lgbserver#building-your-own-lightgbm-server-docker-image)인 것 같다). 밑을 보면 대충 `configmap`을 수정하고 `inferenceservice`에서 이를 명시해주면 된다고 하는데, 어떤 컨피그맵인지도 알려주지 않는다. 

kserve에 배포되어 있는 `inferenceservice-config` 컨피그맵을 한 번 확인해보자.

```bash
kubectl edit -n kserve configmap inferenceservice-config
```

열어서 쭉쭉 내려보면 predictors라는 키가 보인다. 그 밑을 보면 각 서비스에서 사용하는 이미지와 기본 버전 등이 명시되어 있는 것을 확인할 수 있다. 이를 원하는 주소와 버전으로 수정하고 나간다. 이후에는 `kserve` 네임스페이스에 있는 컨트롤러 파드를 제거해 새로운 컨피그맵을 읽어올 수 있게 해주자.

하지만 이 방식은 해당 환경을 사용하는 모든 모델이 같은 이미지를 사용하게 만든다. 만약 여러 모델을 서빙하고 있고 3.7으로도 충분히 돌아가는 모델이 있다거나, 낮은 버전의 패키지를 써야하는 경우 등등은 이런 경우에 오히려 문제가 더 커질 수도 있다.

이를 해결하기 위해 serving runtime이라는 것이 존재한다.

## Serving runtime

kserve에서는 두 가지 Custom Resource, `ClusterServingRuntimes`와 `ServingRuntimes`를 이용해 모델 서빙 환경을 관리한다. 이 클러스터 서빙 런타임과 서빙 런타임은 말 그대로 모델이 실행되는 환경을 관리해주는 리소스이다. 모델이 배포될 때 사용하는 환경변수도 이 서빙 런타임에서 설정할 수 있다. 이름에서 알 수 있듯 앞의 클러스터 서빙 런타임은 네임스페이스 없이 클러스터 단위로 존재하는 리소스이며, 서빙 런타임은 네임스페이스로 구분되는 리소스다. 클러스터롤과 그냥 롤의 차이와 유사하다. 

여기서는 네임스페이스 단위로 구분해서 사용하기 위해 ServingRuntimes를 사용해보자. 마찬가지로 [공식 문서](https://kserve.github.io/website/0.8/modelserving/servingruntimes/)를 한 번 보자. example yaml이 하나 작성되어 있다.

```yaml
apiVersion: serving.kserve.io/v1alpha1
kind: ServingRuntime
metadata:
  name: example-runtime
spec:
  supportedModelFormats:
    - name: example-format
      version: "1"
      autoSelect: true
  containers:
    - name: kserve-container
      image: examplemodelserver:latest
      args:
        - --model_dir=/mnt/models
        - --http_port=8080
```

이 예시에는 아주 아주 아주 큰 **문제**가 하나 있는데 모델의 이름이 명시되어 있지 않다는 것이다. 이 서빙 런타임을 이용해 모델을 배포하면 모델이 기본 이름인 `model`로 배포된다. 만약 Transformer를 사용하고 있는 경우라면 Transformer가 Predictor를 못찾을 것이고, 그냥 Predictor만 배포하는 경우에도 API 엔드포인트의 이름 또한 그냥 model이 되어버린다. 제대로 작성한 올바른 예시는 아래와 같다. `--model_name`이라는 옵션을 추가해주어야 한다. bracket 2개가 특정한 키워드로 설정되어 있어 사진으로 대체한다.

![image](https://user-images.githubusercontent.com/25279765/159698918-b68a9129-5e6e-426d-989b-46c23a3eb3f5.png)

이렇게 해야 inference service의 이름을 가져와 모델의 이름으로 등록하게 된다. supported model format을 이용해 만족하는 패키지의 버전만을 서빙 환경으로 사용할 수도 있다.

이제 Inference service를 한 번 작성해보자.

```yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: example-sklearn-isvc
spec:
  predictor:
    model:
      modelFormat:
        name: sklearn
      storageUri: s3://bucket/sklearn/model.joblib
      runtime: example-runtime
```

model 밑에 런타임을 명시해주었다. 이렇게 하면 kserve controller가 이 inference service의 네임스페이스에서 먼저 이 런타임이 존재하는지 찾고 없다면 클러스터 런타임 서빙을 찾는다. 만약 명시해주지 않는다면 기본 런타임으로 실행될 것이다. 이 방식을 사용하면 원하는 환경을 새롭게 구성해 모델을 배포할 수 있게 된다.

scikit-learn의 경우에는 [기본 설정](https://github.com/kserve/kserve/blob/master/python/sklearnserver/sklearnserver/model.py#L47) 상 확률 대신 argmax를 이용해 하나의 예측 값 만을 내보내게 되어 있다. 하지만 이진 분류 문제를 푸는 경우를 생각해보면 0.5 대신 다른 threshold를 주고 싶을 때도 있기 마련이다. [코드](https://github.com/kserve/kserve/blob/master/python/sklearnserver/sklearnserver/model.py#L24)를 보면 환경변수를 읽어와 확률을 내보낼 수 있다는 것을 알 수 있다. 이 또한 서빙 런타임을 이용해 컨트롤 한다.

```yaml
  containers:
    - name: kserve-container
      image: examplemodelserver:latest
      args:
        - --model_name={{.Name}}
        - --model_dir=/mnt/models
        - --http_port=8080
      env:
        - name: PREDICT_PROBA
          value: "True"
```

위의 예시처럼 컨테이너 밑에 이 서빙 환경에서 사용할 환경변수 또한 넘겨줄 수 있다. 이렇게 PREDICT_PROBA라는 환경변수에 참을 넘겨주게 되면 실제 서빙될 때 예측한 label 대신 각 클래스에 속할 확률을 리턴하게 해줄 수도 있다.
