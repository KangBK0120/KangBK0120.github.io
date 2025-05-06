---
layout: ../../layouts/Markdown.astro
title: kserve istio dex 우회하기
description: "knative, kserve 등 istio 환경에서 dex 인증을 우회하는 법"
category: 개발
pubDate: 2022-03-17
---

# Kserve Istio dex 우회하기

요즈음 kubeflow 등 MLOps적인 부분들을 회사에서 작업하고 있다. 원래는 모델 배포 쪽은 기존 방식대로 진행하려 했지만 데이터 분석팀에서 모델 배포 과정을 빠르게 진행하고 싶어 해 **kserve**도 함께 사용하기로 했다. 온프레미스 환경에서 관련한 테스트를 진행하다 dex 인증 관련 문제를 만나 이를 해결하는 방법에 대해 간단하게 정리한다.

![image](https://www.kubeflow.org/docs/images/Istio-in-KF.svg)
> kubeflow와 istio 구성, [공식문서](https://www.kubeflow.org/docs/external-add-ons/istio/istio-in-kubeflow/)

Kubeflow를 배포하면서 istio와 dex를 함께 배포했다. istio는 서비스 간의 연결을 위해서 사용하고, dex는 인증을 위해서 사용한다. istio를 port forward해서 kubeflow dashboard에 접속해보면 가장 먼저 dex login 창이 연결된다. 그러니까 istio 게이트웨이에 연결하기 위해서는 이 인증 정보가 필요한 것이다.

![image](https://www.kubeflow.org/docs/external-add-ons/kserve/pics/kserve.png)

kserve를 serveless한 구성으로 배포하기 위해서는 knative를 함께 배포해야 한다. 이 knative는 다시 istio를 이용해 서로를 연결한다. 문제는 여기서 발생하는데 api 요청이 istio 게이트웨이를 거치면서 인증 정보가 필요한 것이다. 클러스터 바깥에서 연결하는 경우에만 인증을 요구하면 괜찮은데, 클러스터 내에서 서비스를 통해 연결해도 이러한 인증을 요구한다.

## 설치

kubeflow 배포는 [모두의 MLOps](https://mlops-for-all.github.io/docs/setup-components/install-components-kf/)를 참조했다. 

kserve 설치의 경우에는 [공식 문서](https://kserve.github.io/website/0.8/admin/serverless/)를 참조해 진행했다. 이때 kubeflow 배포 과정에서 이미 istio가 배포되어 있으므로 istio 배포는 제외하고 진행했다. 

## 문제

우선 클러스터 내에 아무 동작도 하지 않는 단순한 파드를 하나 생성해보자. 이 파드에 연결해 내부 서비스로 curl을 보낼 것이므로 curl이 설치되어 있는 이미지를 파드로 배포한다.

```yaml
apiVersion: v1
kind: Pod
metadata:
    name: myapp-pod
    labels:
        app: myapp
spec:
    containers:
    - name: myapp-container
      image: curlimages/curl:7.82.0
      command: ['sh', '-c', 'echo Hello k8s! && sleep 3600']
```

kserve의 경우에는 공식 홈페이지에 있는 [예제](https://kserve.github.io/website/0.8/get_started/first_isvc/#run-your-first-inferenceservice)대로 간단한 iris 예측 모델을 배포한다.

```yaml
apiVersion: "serving.kserve.io/v1beta1"
kind: "InferenceService"
metadata:
  name: "sklearn-iris"
spec:
  predictor:
    sklearn:
      storageUri: "gs://kfserving-examples/models/sklearn/1.0/model"
```

서비스를 확인해보면 이 모델에 대한 서비스가 존재하는 걸 확인할 수 있다.

```bash
kubectl get svc -n kserve-test

NAME                                           TYPE           CLUSTER-IP      EXTERNAL-IP                                            PORT(S)                                      AGE
sklearn-iris                                   ExternalName   <none>          knative-local-gateway.istio-system.svc.cluster.local   <none>                                       133m
```

이제 이 서비스의 이름으로 요청을 보내보자. 우선 위에서 생성한 파드에 연결해야한다.

```bash
kubectl exec --stdin --tty myapp-pod -- /bin/sh
```

그 다음에 예제에 나와 있는 json파일을 생성하고 서비스로 요청을 전송해보자. 

```bash
cat <<EOF > "./iris-input.json"
{
  "instances": [
    [6.8,  2.8,  4.8,  1.4],
    [6.0,  3.4,  4.5,  1.6]
  ]
}
EOF

curl -v http://sklearn-iris.kserve-test.svc.cluster.local/v1/models/sklearn-iris:predict -d @./iris-input.json
```

그러면 아마 응답 코드로 302번과 함께 dex 인증 관련한 정보가 나올 것이다.

사실 이 문제를 해결하려면 요구하는 대로 dex 인증에 관련한 정보를 함께 담아 요청을 보내면 된다. 공식 레포에 [친절한 예시](https://github.com/kserve/kserve/blob/master/docs/samples/istio-dex/README.md)도 있다. 나와있는 대로 CLI에서 지지고 볶을 수도 있고, 심지어는 kubeflow 대시보드에 로그인하고 거기서 사용하는 정보를 가져와 헤더에 담아 요청을 보낼 수도 있다.

하지만 이것만으로 충분할까? 여기서 문제는 istio를 사용하는 모든 어플리케이션이 이 dex 정보를 요구한다는 데 있다. 만약 백엔드 팀에서 istio를 사용한다면 머신러닝 팀에서 사용하는 dex를 위해 그때마다 키를 생성해야만 할까? 비슷한 문제를 겪는 사람들의 이슈도 종종 있는 것 같다([#1](https://github.com/kubeflow/kubeflow/issues/4549) [#2](https://github.com/kubeflow/kubeflow/issues/6401), 첫번째는 2019년에 올라온 이슈지만 두번째는 당장 며칠 전에 올라온 이슈다)

## 원인

왜 이런 문제가 발생할까? 우선 istio virtual service 정보를 확인해보자.

```bash
kubectl get virtualservices.networking.istio.io --all-namespaces
```

그러면 dex에 관한 버추얼 서비스와 이 서비스가 사용하는 게이트웨이를 확인할 수 있다. dex는 kubeflow에서 인증을 위해 사용하니 kubeflow-gateway에 연결된 것을 확인할 수 있다.

이번엔 이 게이트웨이의 정보를 확인해보자.

```bash
kubectl get gateways.networking.io -n kubeflow kubeflow-gateway -o yaml
```

```yaml
spec:
  selector:
    istio: ingressgateway
  servers:
  - hosts:
    - '*'
    port:
      name: http
      number: 80
      protocol: HTTP
```

그러면 셀렉터로 기본 컨트롤러를 사용하고 있는 것을 볼 수 있다. 이 기본 컨트롤러를 사용하는 모든 게이트웨이는 dex의 영향을 함께 받게 된다. knative의 게이트웨이 정보도 한 번 확인해보자.

```bash
kubectl get gateways.networking.istio.io -n knative-serving knative-local-gateway -o yaml
```

```yaml
spec:
  selector:
    istio: ingressgateway
```

마찬가지로 기본 컨트롤러를 사용하고 있는 것을 확인할 수 있다.

## 해결

이 인증을 우회하는 과정이 필요하다. [Envoy filter를 사용하는 방법](https://1week.tistory.com/83)을 찾긴 했는데, 버전이 다른지 잘 안된다. 시도해보고 싶다면 아래 처럼 patch를 수정해야할 수도 있다.

```yaml
patch:
    operation: MERGE
    value:
    name: envoy.ext_authz_disabled
    typed_per_filter_config:
        envoy.ext_authz:
        "@type": type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthzPerRoute
        disabled: true
```

[깃헙 이슈](https://github.com/kubeflow/kubeflow/issues/4549#issuecomment-932259673)에서 찾은 내용으로 시도하니 해결되었다.

istio 문서를 보면 [External Authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/)이라는 내용이 있다. 우리는 이미 dex가 배포되어있으니 authorizer를 추가 배포해줄 필요는 없다. 우선 auth가 필요한 부분을 configmap에 명시해주자. 먼저 configmap을 연다.

```bash
kubectl edit configmap istio -n istio-system
```

그리고 dex 관련한 정보를 여기에 추가해준다.

```yaml
extensionProviders:
    - name: dex-auth-provider
        envoyExtAuthzHttp:
        service: "authservice.istio-system.svc.cluster.local"
        port: "8080" 
        includeHeadersInCheck: ["authorization", "cookie", "x-auth-token"]
        headersToUpstreamOnAllow: ["kubeflow-userid"]
```

깃헙 이슈에서는 kf가 사용하는 호스트만을 딱 명시해주는데, 지금 구성에서는 따로 호스트를 사용하고 있지 않아서 그런가 그대로 사용하면 안된다. 따라서 kserve가 사용하는 경로를 제외해주는 방식으로 접근한다. 아래 정책을 생성한다.

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: dex-auth
  namespace: istio-system
spec:
  selector:
    matchLabels:
      istio: ingressgateway
  action: CUSTOM
  provider:
    # The provider name must match the extension provider defined in the mesh config.
    name: dex-auth-provider
  rules:
  # The rules specify when to trigger the external authorizer.
  - to:
    - operation:
        notPaths: ["/v1*"]
```

그리고 나서 원래 존재하던 authn-filter를 삭제하고 istiod를 재시작한다.

```bash
kubeclt delete -n istio-system envoyfilters.networking.istio.io authn-filter

kubectl rollout restart deployment/istiod -n istio-system
```

이제 아까 연결해둔 파드에서 다시 요청을 보내보면 코드 200과 함께 정상적으로 응답이 나오는 것을 확인할 수 있다. 

사실 이 방식은 사용할 경로를 그때마다 추가해주어야 하는 문제가 있다. 다만 아직까지 fancy하게 kubeflow에만 authorization을 요구하는 방법을 찾지 못했다. 추후 더 좋은 방법을 알게 되면 업데이트할 예정이다.
