---
layout: ../../layouts/Markdown.astro
title: End-to-End Memory Network
description: "Memory Network를 end-to-end로 학습이 가능하게 한 모델인 End-to-End Memory Networ에 대한 리뷰"
category: 개발
pubDate: 2018-03-10
---

# End-to-End Memory Network

## Intro

 메모리 네트워크의 문제점은 Loss를 계산하는 과정에서 supervised가 필요하다는 것입니다. 즉 End-to-End로 데이터만 때려 박아서는 학습이 안된다는 문제가 있는 것이죠. 여기서 소개하는 End-to-End Memory Network는 이러한 문제를 해결하고, End-to-End 형태의 학습이 가능하게 한 Memory Network 입니다.

## Memory Network

 메모리 네트워크에 대해 간단하게 얘기해봅시다. 그 전에 먼저, Seq2Seq 등의 Encoder-Decoder의 구조를 생각해볼까요? Encoder는 문장 혹은 입력을 적절하게 인코딩한, 임베딩 벡터를 만들어냅니다. 보통 임베딩 벡터로는 LSTM 등의 hidden state를 사용합니다. 이렇게 되면 이전 단계의 입력들 또한 반영하는게 가능하기 때문이죠. 하지만 이 과정에서 문제가 하나 있습니다. 입력이 엄청나게 길다면? 과연 이때도 앞 부분의 입력들을 적절하게 반영하고 있다고 생각할 수 있을까요? 이러한 문제를 해결하기 위해 제안된 것이 Memory Network입니다. 메모리에 저장할 수 있는 만큼 최대한 각 단계에서의 hidden state를 저장하고, 이를 활용하는 것이죠. 이를 Memory Network라고 합니다. 하지만 이 방법 또한 아쉽게도 문제가 있는데요, Loss를 구하는 과정에서 supervision이 필요하다는 것입니다. 그럼 이제 End-to-End Memory Network는 이 문제를 어떻게 해결했는지 알아봅시다.

## Approach

 우리는 $x_1, ... x_n$개의 입력과 query $q$를 받아서 답 $a$를 만들어낼 겁니다. 각 $x_i, p, a$는 $V$개의 단어를 가지는 Vocabulary에서 one-hot encoding과 유사한 형태, 즉 문장에서 단어가 포함되어 있다면 1, 없다면 0의 형태로 표현되어 있습니다. 곧 Bag-of-Words 형태인거죠. (Each of the $x_i, q$ and $a$ contains symbols coming from a dictionary with $V$ words)

#### Single Layer

![image](https://user-images.githubusercontent.com/25279765/37243715-a01d7098-24c1-11e8-8c09-cac5b6ac877b.png)

 먼저 레이어가 하나밖에 없는 경우를 생각해보고, 이를 확장시켜 나가봅시다. 우리가 $x_1,...x_i$의 입력을 받았다고 생각해봅시다. 이 각각의 $x_i$들은 embedding matrix를 활용해, $d$차원의 메모리 벡터 $m_i$가 됩니다. 정말 정말 간단하게 표현하면, embedding matrix A($d$ x  $V$)를 곱했다고 생각할 수 있을 겁니다. 위에서 말했듯이, $x_i$는 Bow형태로 표현되어 있습니다. $x_{i, j}$를 $j$번째 단어라고 한다면, 위의 과정은 $m_i = \sum_j{Ax_{i,j}}$라고 표현할 수 있게 되죠.

 query 또한 같은 과정을 통해(단 다른 embedding matrix를 사용합니다) $d$차원으로 임베딩해줍니다. 이렇게 해서 얻은 query의 embedding을 internal state $u$라고 합니다. 이렇게 얻은 $m_i$와 $u$를 내적을 해줍니다. 이렇게 되면 $u$와 가장 유사한 $m_i$를 찾을 수 있겠죠.

$$p_i = \text{Softmax}(u^T m_i)$$

라고 한다면, $p$는 입력에 대한 확률 벡터가 되는 것입니다.

이번엔 다시 다른 embedding matrix $C$를 사용해서 각 $x_i$에서 output vector $c_i$를 만들어냅니다. response vector $o$는 변형된 입력인 $c_i$와 아까 얻은 확률 벡터를 곱한 다음 다 더해줍니다.

$$ o = \sum_i{p_i c_i}$$

즉 $c_i$의 가중합이라고 이해하면 될 것 같습니다. 이제 남은 일은 결과를 만들어 내는 일입니다. output vector $o$와 $u$를 합쳐서 weight matrix에 넣은 다음 Softmax를 취해줍니다

$$ \hat{a} = \text{Softmax}(W(o+u))$$

학습 과정에서는 $a$와 $\hat{a}$간의 cross entropy를 최소화하도록 학습을 진행합니다. 결국 여기서 우리가 학습시키는 파라미터는 matrix들, $A, B, C, W$가 되고, 이들은 smooth하므로 미분이 가능해 역전파를 통해 학습을 시킬 수 있다는 것이 논문의 논지입니다. 이제 이를 multi layer로 확장시켜 보죠.

#### Multiple Layers

$K$개의 layer($K$ hops)를 쌓았다고 해봅시다. 뒷 레이어의 입력으로 들어가는 것은 앞 레이어의 output $o$와 입력 $u$의 합입니다.

$$u^{k+1} = u^k + o^k$$

각 레이어는 이때 각자의 embedding matrix $A^k, C^k$를 가집니다. 그러나 학습 속도나 파라미터 수 등의 측면에서 이를 제한할 겁니다.(밑에서 설명) 마지막 레이어에는 $W$를 사용해 Single layer의 경우에서처럼 결과를 만들어 냅니다.

![image](https://user-images.githubusercontent.com/25279765/37243497-85a8eb38-24bd-11e8-845f-4aba2f5bc3ed.png)

여기서 weight matrix를 위해 사용한 방법은 두 가지입니다. 첫 번째는 **adjacent** 인데요, 앞 레이어의 output embedding을 뒷 레이어의 input embedding으로 사용하는 겁니다. 즉 $A^{k+1} = C^k$가 되는 겁니다. 여기에 추가적으로 answer prediction matrix $W$를 마지막 레이어의 output embedding과 동일하게 설정합니다(W^T=C^K). question embedding의 경우에는 첫 번째 layer의 input embedding을 사용합니다. $B = A^1$. 두 번째로 사용한 방법은 **Layer-wise (RNN-like)** 입니다. 우리가 흔히 생각하는 RNN의 방법을 사용해서 모든 레이어가 $A$와 $C$를 공유하도록 하는 것이죠. 이때에는 $u^{k+1} = Hu^k + o^k$, $H$라는 linear mapping을 추가하고, 이 또한 학습을 진행하면서 바꿔나갑니다.

## Result

여기서 사용한 모델들은 $K = 3$이고, adjacent weight sharing을 사용해 학습을 시켰습니다. Sentence Representation을 할 때, 그냥 Bow만을 사용하는 것이 아니라 $l_{kj} = (1 - \frac{j}{J} - \frac{k}{d}(1-2\frac{j}{J}))$($J$는 단어에서 문장의 수, $d$는 embedding의 차원)이라는 추가적인 파라미터를 만들고, $m_i = \sum_j l_j \cdot Ax_{ij}$로 memory vector를 만들면 성능이 더 좋아진다고 합니다. 또한 학습 과정에서 무작위로 10%의 empty memory를 추가하는 경우, regularization의 효과가 좋았다고 하네요. 밑은 bAbl Task에서 이 모델을 사용했을 때 얻을 수 있는 결과입니다.

![n2n](https://camo.githubusercontent.com/b563d59313f34e16a1fedabf235c568aa45d029b/687474703a2f2f692e696d6775722e636f6d2f6d4b745a376b422e676966)

## Conclusion

Memory Network는 역전파를 통한 학습이 불가능하다는 문제가 있었습니다. 오늘 소개한 End-to-End Memory Network는 이러한 문제를 해결하고자 제시된 모델입니다. 비록 원래의 Memory Network만큼 강한 supervised learning이 아니기 때문에 성능이 하락할 수 밖에 없지만, 적절하게 학습시킬 경우 큰 차이가 나지도 않습니다. 역전파를 통한 간단한 학습이 가능하다는 점에서 End-to-End Memory Network의 가치는 충분해 보입니다.

## Reference

http://solarisailab.com/archives/690

https://github.com/vinhkhuc/MemN2N-babi-python
