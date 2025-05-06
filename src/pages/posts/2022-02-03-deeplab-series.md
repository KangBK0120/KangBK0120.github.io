---
layout: ../../layouts/Markdown.astro
title: Deeplab series 정리
description: "Deeplab v1, Deeplab v2, Deeplab v3, Deeplab v3+ 등 Deeplab series 정리"
category: 개발
pubDate: 2022-02-03
---

# Deeplab series

오늘은 Semantic Segmentation model인 Deeplab 시리즈에 대해서 간단히 정리해보려 합니다. 각 네트워크의 세부 구현은 가능하면 빼고, 주된 Contribution 위주로 정리하였습니다.

## Deeplab v1

###### Semantic Image Segmentation with Deep Convolution Nets and Fully Connected CRFs

DCNN, Deep Convolution Neural Network는 Image classification 등에서 좋은 성능을 가져오고 있었습니다. 이는 DCNN이 가지는 transformation에 대한 invariance함 때문입니다. CNN 중간에 들어있는 Max pooling이나 Strided convolution을 통해 정보의 압축이 지속해서 일어나기 때문에 물체의 위치가 바뀌더라도 robust하게 대응이 가능한 것이죠. 하지만 이러한 특성은 오히려 Segmentation에서는 압축된 정보만을 처리하게 되어 정확한 정보를 얻을 수 없다는 단점이 됩니다. 이런 DCNN이 갖는 문제들을 해결하고자 합니다. 어떤 문제가 있는지, 그리고 이를 어떻게 해결했는지 알아보겠습니다.

### Atrous Algorithm

첫 번째 문제는 Signal Downsampling입니다. 앞서 말씀드렸듯 Max pooling이나 Strided convolution에 의해서 resolution의 크기는 점점 줄어들게 됩니다. VGG16을 예로 들면, 224x224의 이미지가 계속 줄어들어 7x7의 feature map이 됩니다(논문에서는 이를 output stride 등으로 표현합니다, 32분의 1이 되었으니 32 stride입니다). 이렇게 되면 정보의 압축이 일어나 세밀한 정보를 잃게 되고 이는 결국 정확하지 않은 segmentation으로 이어지게 됩니다.

이러한 정보의 압축과 손실을 줄이기 위해 "hole algorithm"(이후 버전에서는 atrous convolution)을 제안합니다. 일반적인 Convolution 연산은 바로 옆에 있는 값들을 연산해 결과를 만들어냅니다. 하지만 Hole algorithm은 filter 사이사이에 0을 집어넣어 이전과 같은 파라미터 숫자를 가지면서 동시에 더 넓은 범위를 처리할 수 있도록 만들어줍니다.

![image](https://user-images.githubusercontent.com/25279765/152357444-c7158895-2c52-4960-b265-ace62de9c5d5.png)

> hole algorithm

### Fully Connected Conditional Random Field

두 번째 문제는 Spatial Invariance입니다. Image classification과 같은 Object centric한 경우에는 spatial transformation에 대해 invariance해야만 합니다. 물체가 어디에 어떻게 위치하는지와 관계없이 그 물체라는 사실은 변하지 않으니까요. 하지만 Segmentation 문제는 그렇지 않습니다. 이런 부분이 DCNN의 spatial accuracy를 제한하게 됩니다. 논문에서는 이를 해결하기 위해 후처리를 하나 제안합니다. 바로 fully-connected Conditional Random Field(CRF)입니다.

이전에도 Noise한 결과를 smooth하게 만들기 위해 CRF가 많이 사용되었다고 하는데요, 이 경우에는 Fully-connected 대신 주변의 정보만을 사용하는 local-range CRF를 사용했다고 합니다. 주변 노드들(픽셀들)을 결합하는 에너지 항이 존재해, 공간적으로 가까운 노드들보다 같은 레이블을 가지는 노드들을 선호하도록 만들어주었습니다. 하지만 이러한 후처리를 하는 것은 local 정보를 더 잘 만들어 sharp한 결과물을 만들기 위해서였는데, 이미 DCNN의 출력은 충분히 smooth해 굳이 이러한 short-range CRF를 사용할 이유가 없다고 합니다. 따라서 저자들은 대신 FC-CRF를 사용합니다. FC-CRF는 다음과 같은 수식으로 정의됩니다.

$$E(\mathbf{x}) = \sum_i \theta_i (x_i) + \sum_{ij} \theta_{ij}(x_i, x_j)$$

$\mathbf{x}$는 픽셀의 label assignment를 나타냅니다. 우변의 첫번째 항은 unary potential로, $\theta_i (x_i) = - \log P(x_i)$, 곧 negative log probability로 정의됩니다. 두 번째 항은 pairwise potential로 $\theta_{ij} = \mu(x_i, x_j)\sum_{m=1}^K w_m * k^m(\mathbf{f}_i, \mathbf{f}_j)$로 정의됩니다. 이때 $i \neq j$일 때만 $\mu(x_i, x_j)$는 1이 됩니다. 아무리 거리가 먼 i, j라고 하더라도 항상 이 값을 구하게 되어 fully connected라는 이름이 붙었습니다.

$k^m$은 i, j의 feature에 의존하는 Gaussian kernel입니다. 여기서 kernel은 

$$w_1 \exp( -\frac{\lVert p_i - p_j \rVert^2}{2\sigma^2_\alpha} -\frac{\lVert I_i - I_j \rVert^2}{2\sigma^2_\beta}) + w_2\exp(-\frac{\lVert p_i - p_j \rVert^2}{2\sigma^2_\gamma})$$

입니다. 첫 번째 커널은 pixel position $p$와 pixel color intensity $I$의 결합으로 정의되며 두 번째 항은 pixel position만을 고려합니다.

Deeplab v1은 이렇게 두 가지 메인 contribution을 제안했습니다. 이제 다음 버전으로 넘어가 봅시다.

## Deeplab v2

###### DeepLab: Semantic Image Segmentation with Deep Convolutional Nets, Atrous Convolution, and Fully Connected CRFs

v2는 전체적으로는 v1과 거의 유사한 모델을 사용합니다. 이전과 마찬가지로 Atrous Convolution, FC-CRF를 사용하지만, ASPP라는 모듈이 추가되었습니다.

### Atrous Spatial Pyramid Pooling

Segmentation을 생각해보면 어떤 물체는 여러 크기로 존재할 수 있습니다. Classification의 경우에는 중앙에 있는 경우 정도만을 고려하면 될테지만, 여기에서는 다양한 크기로 존재할 수 있는 각 물체들을 모두 탐지할 수 있어야 합니다. 가장 직관적으로 사용할 수 있는 방법은 애초에 이미지를 여러 사이즈로 rescale하고 네트워크에 넣은 다음 결과물을 합치는 방법이겠지만, 이렇게 되면 당연히 여러 번의 feed-forward를 거쳐야 하니 Computing cost가 발생하게 됩니다. 이전의 V1에서는 각 pooling layer 뒤에 MLP를 붙여 multi-scale prediction을 사용했었는데요, V2에서는 이를 개선해 ASPP라는 새로운 모듈을 제안합니다.

![image](https://user-images.githubusercontent.com/25279765/152675290-78a7f5ac-a170-4999-b352-71283b8b7506.png)

> Atrous Spatial Pyramid Pooling, ASPP

이전의 제안된 Spatial Pyramid Pooling이라는 방법에서는 하나의 feature map에 다양한 크기의 pooling layer를 섞어 여러 레벨에서의 feature를 만들어냈습니다. 여기서는 Pooling 대신에, 이전에 사용한 Atrous Convolution을 사용합니다. 하나의 feature map에서 여러 rate(atrous convolution에서 사이에 존재하는 0의 개수)를 적용해 다양한 크기에서 이미지를 바라볼 수 있게 해줍니다.

## Deeplab v3

###### Rethinking Atrous Convolution for Semantic Image Segmentation

### Augmented ASPP

V2에서는 다양한 rate를 가지는 Atrous convolution을 이용해 여러 스케일에서 이미지를 바라보고자 했습니다. 하지만 이런 방식에 문제가 하나 있는데, rate가 커지면 커질수록 보게 되는 feature의 숫자가 작아진다는 것입니다. 위의 사진에서 rate가 24인 경우를 생각해봅시다. 만약 어떤 feature map이 이것보다 작게 된다면 zero padding을 제외하고 실제로 보는 feature는 사실상 1x1 Conv와 다를 게 없어지게 됩니다. 따라서 이런 문제를 해결하고자 ASPP를 개량합니다.

![image](https://user-images.githubusercontent.com/25279765/152675700-a50036ce-dd29-4d7d-8d83-dccb9d218863.png)

> Augmented ASPP

이전처럼 다양한 rate의 Atrous convolution과 함께 Image-level feature를 하나 추가해줍니다. 마지막 feature map에 Global Average Pooling(GAP)을 붙인 feature를 하나 더 사용해, 이전의 3x3 Atrous Conv와 합친 다음 1x1 Conv를 거쳐 최종 결과물을 만들어내는 방식입니다. 

또한 이 시점부터는 CRF와 같은 후처리 없이도 좋은 성능을 내기 시작해, CRF를 사용하지 않게 되었습니다.

## Deeplab v3+

###### Encoder-Decoder with Atrous Separable Convolution for Semantic Image Segmentation

### Encoder-Decoder

다양한 스케일의 물체들을 처리하기 위해서 이전 버전들에서는 SPP를 사용해왔습니다. 하지만 이외에도 다양한 방식들을 통해서도 이를 다룰 수 있습니다. 특히 Encoder-Decoder를 사용하는 방식이 잘 알려져 있는데요, 이런 Decoder를 사용하게 되면 압축되었던 정보를 서서히 풀어내면서 Spatial detail을 잘 복원할 수 있게 됩니다. 이전 버전까지는 단순한 bilinear upsample을 사용해왔고, detail을 복구하는 데에는 부족한 점이 많았습니다. 따라서 이번 버전에서는 이전 버전의 ASPP와 인코더 디코더 구조를 결합한 새로운 버전을 제안합니다.

![image](https://user-images.githubusercontent.com/25279765/152675882-758a4227-0005-4049-aa63-cefbcfdd1994.png)

> Deeplab v3+ architecture

복잡한 디코더를 사용하는 대신 간단한 형태로 디코더를 만들었습니다. 이전의 경우에는 ASPP 이후의 Concat + 1x1 Conv한 출력(여기는 연두색)을 그냥 Upsample하여 결과물을 만들어 냈는데요, 한번 Upsample하고, Conv를 거친 다음에 다시 Upsample하는 형태로 바뀌었습니다. 여기에 추가로 인코더의 중간 결과물을 가져와서 함께 합쳐주게 됩니다.

### Depthwise Seperable Atrous Convolution

![image](https://user-images.githubusercontent.com/25279765/152676056-fdd3be72-e98e-4a72-8db4-e52d29c1b38a.png)

> Depthwise seperable convolution

또한 Depthwise seperable convolution의 아이디어를 Atrous convolution에도 적용합니다. Depthwise seperable convolution은 기존의 컨볼루션 연산을 depthwise convolution와 pointwise convolution으로 분해한 방식입니다. 

3차원 feature map, $N * C_{in} * H * W$에서 일반적인 Convolution은 마찬가지로 3차원의 kernel(혹은 filter), $C_{in} * K * K$를 가져야만 합니다. 여기에 추가로 Output channel의 숫자만큼 커널이 필요하니 총 커널의 크기는 $C_{out} * C_{in} * K * K$가 될 것입니다.이를 두 개의 연산으로 분해하면 필요한 커널의 숫자를 줄일 수가 있습니다.

우선 channel 단위로 얇게 썰어 한 번 연산을 수행하며, 이것을 depthwise convolution이라고 합니다. 그러면 여기에선 일단 $C_{in} * K * K$만큼의 커널이 필요하게 됩니다. 또한 채널 별로 쪼개서 구한 값들을 합쳐주기 위한 연산이 필요한데요, 1x1 Conv를 사용하고 이것이 Pointwise convolution입니다. 그럼 이제 $C_{in} * 1 * 1$의 커널이 $C_{out}$만큼 필요하게 됩니다. 따라서 최종으로 사용하는 커널의 숫자는 $C_{in} * (K * K + C_{out})$이 됩니다.

이렇게 depthwise seperable convolution을 사용하면 메모리 사용량을 줄일 수가 있게 되는데요, 이 depthwise conv에 atrous algorithm을 적용하는 것을 제안해 최종 모델을 만들어냅니다.

## Summary

각 버전 별로 주된 Contribution을 정리해보면서 글을 마무리하도록 하겠습니다.

- v1: Atrous convolution과 후처리로 FC-CRF를 제안
- v2: Atrous Convolution을 다양한 rate로 적용하는 ASPP 제안
- v3: ASPP 개량 + 후처리를 사용하지 않음
- v3+: 인코더-디코더 구조 도입 + Depthwise seperable atrous convolution 제안
