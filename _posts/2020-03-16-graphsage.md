---
layout: post
title: Inductive Representation Learning on Large Graphs, GraphSage with Stellargraph
excerpt: "GCN의 일종인 GraphSage를 읽고 정리해보고, Stellargraph library를 이용해 간단한 예제를 학습시켜봤습니다."
categories: [Review, GCN]
comments: true
use_math: true
---

# GraphSage
<h6 align="right">강병규</h6>

오늘은 GCN의 발전된 형태인 [GraphSage](https://cs.stanford.edu/people/jure/pubs/graphsage-nips17.pdf)를 읽고 간단하게 내용을 정리해봤습니다.

## 들어가며

커다란 그래프에서 일반적으로 노드들 사이의 관계는 인접 행렬(adjacency matrix)의 형태로 주어집니다. 이때 인접 행렬은 노드의 수가 많아지면 많아질수록 차원이 점점 커지며, 동시에 점점 Sparse해집니다. 많은 분들이 아시겠지만 Sparse Vector를 다루는 것은 쉽지 않은 일입니다.

이러한 비슷한 문제를 처리하기 위해서 자연어 처리 분야에서는 Word2Vec 등의 기법을 사용합니다. 이를 통해 각각의 단어들을 고차원의 sparse vector에서 저차원의 dense한 vector로 바꿔줄 수 있고, 이로부터 단어와 단어사이의 유사도 등을 구해낼 수 있습니다.

마찬가지로 이러한 노드들의 관계를 저차원으로 표현할 수 있다면 각각의 노드 사이의 관계를 보다 효과적으로 판단할 수 있게 될 것입니다. 그래프를 입력으로 해서 Node(혹은 정점, Vertex)의 임베딩을 만들어내는 네트워크를 Graph Neural Network라고 합니다. (다양한 Variation이 존재하지만, Node-level에 대해서만 우선 고려합시다)

하지만 기존까지의 방법들은 보지 못한 노드들에 대해서는 임베딩을 만드는 데에 어려움이 있었습니다 - 이를 논문에서는 Transductive하다고 말합니다. 예를 들면, 트위터의 유저들이 그래프의 형태로 주어져있다고 생각해봅시다. 유저가 Node가 될 것이고, 이들 사이의 관계, 팔로우가 Edge가 될 것입니다. 시간이 지날수록 트위터의 유저들(Node)은 늘어날 것이고, 서로를 팔로우하는 경우(Edge)도 함께 늘어날 것이지만, 기존의 방법들은 보지못한 노드를 적절하게 처리할 수 없으니 여러 제약이 발생합니다. 이를 극복하고자 이 논문에서 제안하는 것이 바로 GraphSage입니다.

## GraphSage

일반적으로 생각해봤을 때, 서로 연결된 노드, 혹은 정점들은 비슷한 정보를 가질 것이라고 생각할 수 있습니다. 따라서 GraphSage는 어떠한 정점의 feature를 만들기 위해, 주변의 정보 또한 활용하고자 합니다. SAGE는 SAmple과 aggreGatE가 결합된 단어입니다. 말 그대로 Neighbor를 Sampling하고 Aggregating한다고 생각할 수 있습니다. 먼저 모든 파라미터들이 학습되어 있다고 생각하고 Forward propagation이 어떤 식으로 진행되는지 알아봅시다.

### Forward

$\mathcal{G} = \mathcal{(V, E)}$, 우선 그래프는 정점과 그 정점 사이의 연결인 간선들의 집합으로 정의됩니다. 각각의 정점들에 대해서 우리는 입력으로 주어지는 feature를 알고 있다고 가정합니다. $\{\mathbf{x}_v, \forall v \in \mathcal{V}\}$. 또한 하이퍼 파라미터로 깊이를 의미하는 $K$를 정의합니다. 이 깊이만큼 우리는 $\text{AGGREGATE}_k$와 Weight matrix $\mathbf{W}_k$를 가집니다. 또한 이웃의 정보를 활용하고자 하니, 이를 표현하는 함수를 $\mathcal{N} : v \to 2^\mathcal{V}$라고 합시다. 이때 매우 큰 그래프에서 연결되어 있는 모든 노드의 정보를 반영하는 것은 많은 연산이 필요한 일이니, 적절한 수만큼의 노드를 샘플링해서 Neighbor로 정의합니다. 

전체적인 알고리즘은 아래와 같습니다.

![image](https://user-images.githubusercontent.com/25279765/76822513-a7cd1b80-6854-11ea-9336-ea3133cd60f1.png)

입력으로 주어진 Depth만큼, 계속해서 feature를 학습해나가게 됩니다. 가장 먼저 주변 노드들의 정보를 모아 AGGREGATE 함수로 처리하고, 이렇게 얻은 $\mathbf{h}^k_{\mathcal{N}(v)}$를 정점의 이전 상태 정보인 $\mathbf{h}_v^{k-1}$과 합쳐주고 Weight matrix $\mathbf{W}$를 곱해준다음, 활성화 함수에 넣어줍니다.

Depth번 만큼 이를 학습해주었다면, 마지막에 얻은 Feature들을 최종 출력으로 결정합니다.

위에서 제시한 알고리즘은 미니배치 세팅을 고려하지 않은 알고리즘입니다. 이를 미니배치를 이용한 형태로 바꿔준 알고리즘은 아래와 같습니다.

![image](https://user-images.githubusercontent.com/25279765/76823398-77d34780-6857-11ea-88ab-e2cfa187b226.png)

전체적인 형태는 이전과 유사한 것처럼 보이지만, 조금 달라진 점은 1-7번까지의 Line이 새로 추가되었다는 점입니다. 기본적인 아이디어는 필요한 모든 노드들을 미리 저장해두는 것입니다. 필요한 노드들만을 모아 미리 가지고 있는 것이죠.

논문에서는 일반적으로 K = 2를 사용했다고 합니다. 이를 그림으로 나타내면 아래와 같게 됩니다.

![image](https://user-images.githubusercontent.com/25279765/76823847-bc131780-6858-11ea-956f-0daf94342329.png)

가운데 빨간 색 노드가 우리가 뽑은 배치에 들어간 노드라고 한다면, 이 노드가 $\mathcal{B}^2$에 속한 노드가 될 것입니다. 이 노드의 Neighbor들을 샘플링한 것이 $\mathcal{B}^1$이 되고, 다시 $\mathcal{B}^1$에 속해있는 노드들의 Neighbor를 모은 것이 $\mathcal{B}^0$가 됩니다. 따라서 어떠한 노드가 주어졌을 때, 그 노드와 바로 연결되어 있는 노드가 k=1에 속한 노드가 되고, k=1에 있는 노드들과 연결되어 있는 노드들이 k=2에 속한 노드가 되는 것이죠. 결과적으로 k=2에 속한 노드를 이용해 k=1에 속한 노드들의 feature를 구하고, 이를 이용해 최종적으로 우리가 원하는 노드의 feature를 구하게 되는 것입니다.

## Backword

feature들을 만들어내는 forward pass에 대해 알았으니 이제 backward pass에 대해 알아봅시다. 앞서 말했듯 가장 직관적인 아이디어는 연결되어 있는 노드들은 서로 비슷한 성질, feature를 가질 것이라는 생각입니다. 이를 반영한 Loss function은 아래와 같습니다.

$$J_\mathcal{G}(\mathbf{z}_u) = - \log(\sigma(\mathbf{z}_u^\intercal \mathbf{z}_v)) - Q \cdot \mathbb{E}_{v_n \sim P_n(v)}\log(\sigma(-\mathbf{z}_u^\intercal \mathbf{z}_{v_n}))$$

$v$는 $u$의 이웃하는 노드들이라고 생각하면 되며, $P_n$은 Negative sampling distribution을 의미합니다. 결국 이웃하는 노드들은 서로 비슷한 값을 가지게 만들고, 그렇지 않은 노드들은 다른 값을 가지도록 하는 것이 목표가 됩니다. 이때 위의 Loss를 Supervised한 세팅으로 바꾸는 것 - 이를테면 Cross Entropy - 도 가능합니다.

## Aggregator

마지막으로 남은 것은 Aggregator 함수의 구조입니다. 문장에서의 단어 등과 다르게 노드들 사이에는 순서가 없다는 사실에 주의해야합니다. 따라서 이웃하는 노드들을 입력으로 받는 Aggregator는 이러한 순서에 영향을 받지 않는 함수여야 합니다. 

가장 직관적으로 떠올릴 수 있는 함수는 아마 평균이 될 것입니다. 

$$h_v^k \gets \sigma(\mathbf{W} \cdot \text{MEAN}(\{\mathbf{h}_v^{k-1}\}  \cup \{\mathbf{h}^{k-1}_u, \forall u \in \mathcal{N}(v) \})$$

이때 Mean을 사용하는 경우에는 Concat 연산을 따로 적용하지 않는다는 점에 주의해야합니다. 

또 다른 Aggregator로 LSTM을 제안합니다. Mean과는 달리 파라미터를 사용하니 더 높은 표현력을 가지겠지만, 순서가 존재한다는 점이 차이입니다. 따라서 임의의 순서로 섞은 이웃 노드들을 입력으로 주게 됩니다.

마지막 Aggregator로 Pooling Aggregator가 있습니다. 순서와 상관없으며, 학습이 가능하다는 장점이 있습니다. 이웃의 feature들이 각각 fully-connected layer에 입력으로 주어지게 됩니다.

$$\text{AGGREGATE}_k^\text{pool} = \max( \{ \sigma(\mathbf{W}_\text{pool}\mathbf{h}^k_{u_i} + \mathbf{b}), \forall u_i \in \mathcal{N}(v) \})$$

여기에서 $\max$는 element-wise max 연산입니다. W대신 더 복잡한 Multi-layer를 사용하는 것도 물론 가능하지만, 여기에서는 단순한 Single-layer를 사용합니다. 이웃 각각의 벡터들 중에서 중요한 정보만을 뽑아서 반영한다고 생각할 수 있게 됩니다. 

