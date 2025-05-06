---
layout: ../../layouts/Markdown.astro
title: Database Upsert with SQLAlchemy
description: "데이터베이스에서 Insert와 실패 시 Update를 수행하는 Upsert에 대한 정리"
category: 개발
pubDate: 2022-01-12
---

# Upsert

최근 API를 유지보수하면서 발생했던 이슈와 해결책을 간단히 정리하려 합니다.

## 기존

저희 팀에서 지원하는 API 중 외부 API를 사용하는 기능이 존재합니다. 기존의 상황을 그려보면 아래와 같은 흐름이 될 것입니다.

![diagram1](https://user-images.githubusercontent.com/25279765/149149667-46857c8b-710a-4887-8f8f-025f5f44413c.png)

현재 API는 쿠버네티스상에서 동작하고 있습니다. 앞단에는 인그레스가 붙어 있어 들어오는 요청을 파드로 전송해줍니다. 그러면 파드에서는 내부 동작을 수행하면서 필요시 외부 API와 소통하게 됩니다.

하지만 외부 API를 이용하다 보니 비용에 대한 이슈가 발생했습니다. 따라서 간단한 캐싱용 데이터베이스를 연결해 사용하기로 했습니다. Key-Value를 저장하기 위해 Redis를 사용할 수도 있겠지만 사용이 어렵다는 조언을 들어 간단하게 쓸 수 있는 AWS RDS 상의 PostgreSQL을 쓰기로 했습니다.

## 계획

전체적인 흐름은 기존과 같습니다. 다만 달라진 것이 있다면 바로 외부 API로 요청을 전송하는 대신에 DB에서 기존의 입력이 존재하는지 확인을 거치는 부분입니다. 이를 다시 그림으로 나타내면 아래와 같을 것입니다.

![diagram2](https://user-images.githubusercontent.com/25279765/149150125-b5b67ad2-f466-42d7-98f9-be202fb37518.png)

요청이 파드로 들어오면 파드는 해당하는 요청이 기존에도 들어온 요청인지 확인합니다. 만약 이전에 같은 요청이 들어온 적이 있으면 외부 API와 통신하는 대신 데이터베이스에 저장된 응답을 반환합니다. 만약 데이터베이스에 해당하는 요청이 없는 경우에는 외부 API와 통신하고, 그 결과를 DB에 저장합니다.

## 문제

코드는 금방 작성했지만 예상치 못한 부분에서 이슈가 발생했습니다. 

![diagram3](https://user-images.githubusercontent.com/25279765/149151503-5ec43ddd-4622-401b-a2df-6d00a0c98500.png)

만약 유저가 어떤 버튼을 연속해서 여러 번 누르는 경우에는 같은 요청이 동시에 여러 파드로 흘러들어가게 됩니다. 

![diagram4](https://user-images.githubusercontent.com/25279765/149151713-04d06f28-56c6-4d01-a1da-11e47c904af4.png)

이때 이 요청이 DB에 없는 경우 두 파드는 외부 API에 요청을 보내고 응답을 받아옵니다.

![diagram5](https://user-images.githubusercontent.com/25279765/149152101-b4efbd65-5f7e-448b-8c4d-1f5f8d667932.png)

이제 두 파드는 이 요청을 DB에 기록하려 합니다. 하지만 이 두 요청 모두 같은 입력값을 가지게 되므로 여기서 충돌이 발생하여 나중에 시도한 삽입은 실패하게 됩니다.

## 해결

문제는 기존에 존재하는 PK(요청의 입력이라고 합시다)에 대해서 데이터베이스에 삽입을 시도하기 때문에 발생합니다. 이러한 충돌이 발생했을 때 기존의 값을 새로 바꿔쓰는 연산을 Upsert라고 표현합니다. Upsert는 Update + Insert를 합친 말인데요, 만약 PK가 존재하지 않을 때에는 그대로 삽입하고, 키가 이미 존재하는 경우에는 이를 갱신하는 동작을 의미합니다. 파이썬에서 dictionary같은 느낌이라고 할까요?

현재 API는 파이썬을 사용하고 있었고, 데이터베이스 접근을 위해서는 SQLAlchemy를 사용하고 있었습니다. 다행히도 sqlalchemy에서는 이러한 처리를 아주 간단하게 수행할 수 있습니다. 여기서는 굳이 새로운 값으로 갱신이 필요하지 않아 `on_conflict_do_nothing`을 사용하였습니다.

```python
from sqlalchemy.dialects.postgresql import insert
insert_stmt = insert(my_table).values(
    id='existing_id',
    data='some_value'
)
do_nothing = insert_stmt.on_conflict_do_nothing(
    index_elements=['id']
)
```
> 출처: https://docs.sqlalchemy.org/en/14/dialects/postgresql.html#insert-on-conflict-upsert

이렇게 하니 중복된 삽입을 시도하다 충돌이 발생해도 아무 동작도 수행하지 않으므로 오류가 발생하지 않게 되었습니다.
