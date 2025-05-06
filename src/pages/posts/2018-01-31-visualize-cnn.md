---
layout: ../../layouts/Markdown.astro
title: Visualizaing and Understanding Convolution Networks 리뷰
description: "다양한 실험을 통해 CNN의 작동 방식을 연구한 논문입니다."
category: 개발
pubDate: 2018-01-31
---

# Visualizaing and Understanding Convolution Networks 리뷰
<h6 align="right">강병규</h6>

## Intro

Convolutional Neural Network는 이미지 분류 등의 분야에서 좋은 성능을 보여주고 있습니다. 그런데 우리는 왜 CNN이 잘 작동하는가에 대한 인식을 전혀하지 못하고 있습니다. 더불어 어떻게 해야 성능을 개선할 수 있는지에 대해서도 잘 알지 못하구요. [이 논문](https://arxiv.org/abs/1311.2901)에서는 이러한 문제들에 초점을 맞춰 연구를 진행했습니다. "왜 CNN이 좋은 성능을 내나?", "어떻게 해야 CNN의 성능을 개선할 수 있나?" 이 두 질문에 대해서 말이죠. 이 논문이 작성되던 시기에 최고 성능을 보여주던 AlexNet을 이 논문에서 제안한 방법을 통해 개선한 결과 성능이 더 좋아졌다고는 합니다.

ConvNet이 좋은 성능을 낼 수 있게 해준 원동력은 크게 세 가지를 꼽을 수 있습니다. 첫째로 대용량의 데이터셋이 등장했고, 두번째로 GPU의 등장으로 더 빠른 연산이 가능해졌습니다. 이는 더 깊고 큰 모델을 설계할 수 있게 해주었습니다. 마지막으로는 Dropout과 같은 regularization 방법들이 등장했기 때문입니다. 그러나 여전히 우리는 CNN내의 연산과 어떻게 좋은 성능을 내는지를 잘 알지 못합니다. 이를 해결하지 못하는 이상 딥러닝은 여전히 trial-and-error에 머물 수 밖에 없습니다. "그냥 돌려봤더니 잘 되더라" 말이죠. 결과적으로 CNN의 작동 방식에 대해 알기 위해서는 중간에 위치한 레이어들의 feature activity를 알아야합니다. 이 논문에서는 이를 위해 Deconvolution을 사용합니다. 일반적인 CNN에서 입력(input) -> Convolution -> feature activation이라면 Deconv는 역연산을 위해 사용합니다, 즉 feature activation -> Deconv -> input이 되는 것이죠.

## DeconvNet

![screenshot 2018-01-31 at 10 55 02](https://user-images.githubusercontent.com/25279765/35601226-3d37c9d4-0675-11e8-888c-def7bded76de.jpg)

일반적인 CNN의 구조를 생각해보면 입력 -> Convolution -> ReLU -> (+ maxpool) 정도라고 생각할 수 있습니다. 저런 블록을 여러 개 쌓아 CNN을 이룰텐데요, Deconv block을 저 layer마다 붙여줍니다. 나머지는 이제 반대의 연산을 수행해주면 됩니다. 하지만 생각해보면 Maxpool은 non-invertible합니다. 완전한 복원이 불가능하죠. 최대값만을 남기고 나머지는 지워버리니까요. 이를 해결하기위해서 추가적인 변수(*switches*) 하나를 더 만들어 maxpool에서 max값이 위치한 픽셀 정보를 저장을 합니다. max값의 위치는 보존이 가능한 것입니다. 결과적으로 완전한 복원까지는 아니더라도 어느 정도의 복원은 가능하게 됩니다. 나머지는 크게 어려울게 없습니다. ReLU는 그대로 사용하고요. 그래야 양의 값을 가지는 부분은 그대로 양의 값을 가질테니까요. 마지막으로 Deconv연산을 수행해 원래의 이미지를 복원하고자 합니다.

여기서 CNN으로 사용한 모델은 아래 사진과 같습니다.

![screenshot 2018-01-31 at 10 56 55](https://user-images.githubusercontent.com/25279765/35601266-762b508a-0675-11e8-8619-7ebc07b550b6.jpg)


## Results

그래서 결과는 어떻게 나왔을까요? Validation set에서 feature activation들을 무작위로 뽑아낸다음 이 중에서 가장 activation이 잘된 9개를 뽑아냅니다. 이후 이를 다시 원래의 픽셀로 복원하는 과정을 거치죠. 이렇게 해서 얻은 결과는 아래와 같습니다.

![screenshot 2018-01-31 at 11 10 39](https://user-images.githubusercontent.com/25279765/35601622-61f3e512-0677-11e8-8e80-4ae0338e317d.jpg)
> 2번째 레이어에서의 결과, 더 자세한 결과는 논문에 있습니다.

보면 한 feauter map이 일관성있는 결과를 뽑아내고 있다는 것을 확인하고 있습니다. edge면 edge, 동그라미면 동그라미인 식으로 말이죠. 또한 더 깊은 레이어로 갈수록 invariance해지면서 더 고차원적인 특징을 뽑아냅니다. 이외에도 다양한 실험을 수행을 했습니다.

![screenshot 2018-01-31 at 11 17 29](https://user-images.githubusercontent.com/25279765/35601822-561c3ed2-0678-11e8-9a4b-8388f0636df5.jpg)

학습이 진행되면서 feature map이 학습되는 과정입니다. 보시면 알겠지만 낮은 레이어에서는 빠르게 수렴하지만 깊은 곳에 있는 레이어가 특징을 학습하기 위해서는 꽤 많은 시간이 필요하다는 것을 알 수 있습니다.

![screenshot 2018-01-31 at 11 20 55](https://user-images.githubusercontent.com/25279765/35601923-d2efbfe2-0678-11e8-9eec-2cd9357b138b.jpg)

여기서는 입력이 translated되고, 회전되고 크기가 달라질때 feature가 어떻게 변하나 관찰했습니다. 얕은 레이어에서는 입력이 조금 변화하면 feature가 꽤나 많이 바뀌지만 깊어질수록 변함없는 결과를 보여준다고 하네요. 단 rotation에는 invariance하지 않습니다. 즉 결과가 좀 달라질 수 있습니다.

뭐 이런식으로 얻을 결과를 통해 AlexNet의 구조를 조금 바꿨더니 훨씬 좋은 결과를 얻었다고 합니다. 이것말고 또 다른 실험들을 수행했습니다. 이미지 분류를 한다고 했을 때, CNN은 사진에서 물체의 위치를 정확하게 인식한다음 분류하는 것일까요? 아니면 그냥 주변 정보를 활용하는 것일까요?

![screenshot 2018-01-31 at 11 25 26](https://user-images.githubusercontent.com/25279765/35602044-7250d6ca-0679-11e8-94ff-88d6a8de2465.jpg)

이를 위해서 입력 이미지의 일부를 회색으로 가리는 방법을 사용했습니다. 보시면 아시겠지만 물체를 회색으로 가렸을 때 정확도가 확 떨어진다는 것을 볼 수 있습니다. 즉 CNN은 물체의 위치를 정확하게 파악하고 분류한다는 것을 알 수 있죠.

![screenshot 2018-01-31 at 11 40 18](https://user-images.githubusercontent.com/25279765/35602415-8633a580-067b-11e8-8b05-31ccefd5108d.jpg)

마지막 실험인데요, 다양한 개 사진에서 똑같은 위치를 가린다음 비교하는 실험입니다. 즉 다양한 사진에서 똑같이 왼쪽 눈을 가린다던가 하는 식으로 말이죠. 이렇게 했더니 큰 차이가 없었다고 합니다. 즉 CNN은 다른 사진에 있는 같은 물체의 정보를 제대로 인식하고 있다는 결론을 내리면서 끝이 납니다.
