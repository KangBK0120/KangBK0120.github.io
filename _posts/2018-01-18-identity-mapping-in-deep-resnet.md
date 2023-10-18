---
layout: post
title: Identity Mappings in Deep Residual Networks 리뷰
excerpt: "CNN을 활용한 모델 중 하나인 ResNet을 다양한 구조로 실험한 논문입니다."
category: ML
---

# Identity Mappings in Deep Residual Networks
<h6 align="right">강병규</h6>

안녕하세요 오늘 리뷰할 논문은 [Identity Mappings in Deep Residual Networks](https://arxiv.org/pdf/1603.05027.pdf)(He et al)입니다. 전체적으로 기존에 나왔던 Residual Network(이하 ResNet)이 왜 좋은 성능이 나오나 검증하는 논문의 성격을 띕니다. 또한 논문에서 기존의 논문이 제시한 구조외의 이런저런 변형을 가했을 때 성능이 어떻게 변하는지도 검증하고 있습니다. 시작합니다.

## ResNet

ResNet은 Residual Units이라고 하는 블록을 쌓은 형태로 이루어져 있습니다. 이 부분에 대해서는 간략하게만 소개하고 넘어가겠습니다. 이 블록을 수식으로 표현하면

$$y_l = h(x_l) + F(x_l, W_l),$$

$$x_{l+1} = f(y_l)$$

이라고 할 수 있죠. 여기서 $x_l$은 Residual Unit에 들어가는 입력이며, $x_{l+1}$은 그 출력입니다. $h$는 identity mapping을 의미합니다. 따라서 $h(x_l) = x_l$이죠. 바로 skip connection부분이라고 생각하시면 됩니다. $F$는 ResNet에서 입력이 거치는 residual function입니다. 곧 3x3 Conv 등을 거치는 경로이죠.skip connection부분이 아닌, 여러 연산을 거치는 경로를 의미하는 것입니다. $f$는 우리가 흔히 생각하는 ReLU이구요.

이 논문에서는 "direct" path에 대한 실험을 중점적으로 수행했습니다.

## 2. Analysis of Deep ResNet

Residual Unit의 기본 함수는

$$y_l = h(x_l) + F(x_l, W_l),$$

$$x_{l+1} = f(y_l)$$

이죠. $x_{l+1} \equiv y_l$인 경우, 즉 $f$ 또한 identity mapping인 경우를 생각해봅시다. 위에서 두번째식과 첫번째식을 합쳐줄 수가 있습니다. 이렇게 되면

$$x_{l+1} = x_l + F(x_l, W_l)$$

이 됩니다. 여기서 재귀적으로 얘네를 풀어쓰면

$$x_L = x_l + \sum_{i=l}^{L-1}F(x_i, W_i)$$

가 됩니다. $L$은 어떤 깊은 unit, $l$은 어떤 얕은 unit, 즉 $L$이 $l$보다 깊기만 하면 위의 식은 성립합니다(처음 입력을 받는 부분에 가까울수록 얕다고 합시다). 이때 위의 식은 얕은 곳에서 깊은 곳으로 갈 때, 깊은 곳의 feature $x_L$이 $x_l$과 Residual function의 합들로 이루어져 있다는 것을 보여줍니다.

앞서 말했지만 이 부분은 **$f$가 identity mapping** 인 경우입니다

바로 위의 식을 역전파시키기 위해 미분한다면 어떻게 될까요?

![backprop1](https://user-images.githubusercontent.com/25279765/35078369-4b40d640-fc45-11e7-90f0-2285712ecb08.jpg)

> $\mathcal{E}$는 loss를 의미합니다

요렇게 됩니다. 즉 gradient $\partial{\mathcal{E}} \over \partial{x_l}$이 두 개로 분리될 수 있는 것이죠. 앞의 식 $\partial{\mathcal{E}} \over \partial{x_L}$은 정보를 **바로** 전달한다는 것을 의미하며, 뒤의 항은 정보가 weight layer들을 거쳐서 전파되는 것을 의미합니다.

생각해보면 뒤의 항이 미니배치 내의 모든 데이터에서 -1인 경우는 극히 드물겠죠. 따라서 weight가 작더라도 gradient가 사라지지 않습니다(vanishing gradient문제가 없습니다)

## 3. On the Importance of Idnetity Skip Connections

자 그래서 정말로 identity mapping이 최고의 결과를 가져다 줄까요? 이 논문에서는 이를 검증하기 위해 다양한 variation을 줬습니다.

가장 먼저 contant scaling입니다. $h(x_l) = \lambda_l x_l$이라고 해봅시다. 이때 $f$는 여전히 identity하다고 가정합니다. 이를 $x_L$과 $x_l$로 풀어쓴다음, 쭉 재귀적으로 늘어써보면

$$x_L = (\prod_{i=l}^{L-1}\lambda_i)x_l + \sum_{i=l}^{L-1}\hat{F}(x_i, W_i)$$
> $\hat{F}$는 $F$앞에 붙어야하는 $\lambda$들을 합쳐서 표현한 것입니다.

가 되겠죠. 얘를 역전파시키기 위해 미분을 한다면 아래와 같아집니다.

![backprop 2](https://user-images.githubusercontent.com/25279765/35078764-17fb9250-fc47-11e7-8fe7-303868d9ba84.jpg)

아까와 다른 점은 $\prod_{i=l}^{L-1}\lambda_i$가 더 붙었다는 점입니다. 조금만 더 생각을 해보면 $\lambda_i > 1$이면 너무 커질 것이고, $\lambda_i < 1$이면 너무 작아지겠죠. 이렇게 된다면 shorcut path를 통한 역전파를 방해할 것입니다. 또 여기서 만약 constant scaling이 아니라 어떤 더 복잡한 식, 1x1 Conv 등을 적용했다면 어떻게 될까요? 복잡한 함수를 $h$라고 한다면 $\prod_{i=l}^{L-1}h^\prime$이 되겠죠. 이 또한 역전파과정을 방해하게 됩니다.

그래서 이를 검증하기 위해 다양한 네트워크를 설계합니다.

![shortcut connection](https://user-images.githubusercontent.com/25279765/35079214-696cab4a-fc49-11e7-85fe-1693c432836c.jpg)

Constant Scaling의 경우에는 $F$에는 적용하지 않은 경우, $1-\lambda = 0.5$만큼 적용한 경우로 구분할 수 있습니다. Gating의 경우에는 $g(x) = \sigma(W_gx+ b_g)$를 적용한 것인데요, 여기서 $g(x)$는 1x1 Conv와 Sigmoid를 의미합니다

Exclusive gating의 경우에는 $F$는 $g(x)$만큼 곱해주고(element-wise), shorcut path에는 $1-g(x)$를 곱해준 것입니다. shorcut-only gating의 경우에는 shorcut path만 $1-g(x)$를 적용했구요. 이외에도 shortcut에 1x1Conv를 적용하거나 dropout을 적용하고 실험을 진행했습니다.

![result1](https://user-images.githubusercontent.com/25279765/35079415-a1d51386-fc4a-11e7-8d11-d994a1a21d8f.jpg)

결국 shorcut의 정보를 훼손시키지 않는 것이 제일 좋다는 이야기를 하고 있습니다. shorcut path에 어떤 곱연산을 시도하면 최적화하는데 방해가 된다는 얘기지요.

## 4. On the Usage of Activation Function

위에서 우리는 shorcut path를 손상시키지 않는 것이 가장 좋다는 걸 알았습니다. 여기에서는 활성화함수에 대한 여러 실험을 진행합니다. 우리는 $f$가 identity mapping이 되도록 하고싶죠. 이는 ReLU나 BN등을 조합해서 구현하게 됩니다.

![activation](https://user-images.githubusercontent.com/25279765/35079529-79a6d1d2-fc4b-11e7-8066-581302560d6f.jpg)

원래 ResNet의 구조는 a와 같습니다. BN이 각 weight layer 다음에 들어가있고, 이후 ReLU를 거치죠. 마지막에는 addition을 한다음 ReLU를 적용합니다. 나머지는 이 논문에서 실험해본 구조들입니다.

b의 경우에는 더한 다음 BN을 적용한 것이구요, c는 더하기 전에 ReLU를 넣은 것입니다. 나머지 두 개는 밑에서 조금 자세히 설명합니다.

원래의 구조를 보면 activation이 shorcut과 residual path 모두에 영향을 미칩니다. $y_{l+1} = f(y_l) + F(f(y_l), W_{l+1})$ 이렇게 말이죠. 여기서 구조를 조금 비틀어봅시다. $\hat{f}$라고 해서 $F$에만 활성화함수를 적용하는 것이죠. 그럼 식이 이렇게 변합니다.  $y_{l+1} = f(y_l) + F(\hat{f}(y_l), W_{l+1})$. $y_l$을 $x_l$로 notation만 바꿔주면 식이

$$x_{l+1} = x_l + F(\hat{f}(x_l), W_l)$$

로 변하게 되죠. 이를 사진으로 보면 이렇게 됩니다.

![pre-activation](https://user-images.githubusercontent.com/25279765/35079995-2776c86a-fc4e-11e7-80cd-8c589017d761.jpg)

이렇게 변형한 모델의 결과는

![activation2](https://user-images.githubusercontent.com/25279765/35080092-d4f96cfe-fc4e-11e7-8a87-0a7a159d649b.jpg)

였습니다. full pre-activation을 적용한 경우 기본 모델보다 성능이 좋아졌다는 특징이 있습니다. 그런데 여기서 특이한 점이 하나 있었습니다.

![error](https://user-images.githubusercontent.com/25279765/35080138-1baa1216-fc4f-11e7-8606-e342c5e61c42.jpg)

pre-activation을 적용한 모델의 경우 기본 모델보다 training set에 대한 정확도는 낮지만, test에 대한 정확도는 더 높았습니다. 이 논문에서는 이러한 결과가

1. pre-activation을 적용한 경우 최적화가 훨씬 쉬워졌다.
2. BN이 모델의 regularization 역할을 수행했다.

라고 주장합니다.

## Conclusion

결국 요약해보자면, shorcut path의 정보는 가능한 손상시키지 않는 것이 역전파, 정보의 전달 측면에서 유리하며, residual path에서는 shorcut과 합쳐주기 전에 activation을 취해주는 것이 유리하다는 것입니다. 즉 이 논문은 기존 ResNet을 조금 더 개량한 새로운 ResNet을 주장합니다.

![new model](https://user-images.githubusercontent.com/25279765/35080240-a28aef3a-fc4f-11e7-8acd-3717adea8098.jpg)

바로 오른쪽 모델처럼 말이죠.
