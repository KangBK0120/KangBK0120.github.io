---
layout: post
title: Pytorch로 DCGAN 구현해보기
excerpt: "CIFAR-10 데이터를 이용해 DCGAN을 Pytorch로 구현해보았습니다."
categories: [GAN]
comments: true
use_math: true
---
# DCGAN으로 만들어보는 CIFAR-10

<h6 align="right">강병규</h6>

안녕하세요. GAN이 처음 등장한 이후로 여러가지 변형이 만들어졌습니다. 오늘은 그중에서도 DCGAN을 pytorch로 구현해보고자 합니다.

## DCGAN?

DCGAN, GAN은 알겠는데 앞에 DC는 무슨 뜻일까요? Deep Convolutional Generative Adversarial Networks를 줄여서 DCGAN이라고 부릅니다. 이미지를 분류하는 문제 등에서 CNN, Convolutional Neural Networks라는 말을 들어보신 적이 있으실겁니다. 이미지를 만들어내는 GAN에서도 이러한 Convolution을 적용할 수 있지 않을까? 하는 생각에서 DCGAN이 등장한 것입니다.

이미지는 사실 3차원의 데이터, 큐브라고 생각할 수 있습니다. 픽셀 하나하나는 RGB 값을 가집니다. 즉 64 x 64 이미지는 사실 3 x 64 x 64의 데이터와 같은 겁니다. CNN이 기존의 MLP(Multi-Layer Perceptron)과 다른 점은 바로 이 부분입니다. 기존의 MLP는 3차원의 데이터를 1개의 벡터로 풀어서 인식합니다. 이런 경우 이미지에서 위치정보를 무시하게 된다는 문제점이 발생하게 되죠. 사진에서 사람의 얼굴을 인식하고자 하는 경우 눈과 코의 위치는 중요하지만 이를 무시하는 것입니다. 하지만 CNN은 3차원의 이미지를 그대로 입력으로 취하기 때문에 이러한 위치정보를 반영할 수 있게 됩니다.

이미지를 10개의 클래스로 분류하는 CNN의 경우를 생각해봅시다. 3차원의 이미지가 일련의 layer를 거쳐 각 클래스에 해당하는 확률값들이 나오게 됩니다. 즉 3차원의 이미지 -> 1 x 10의 벡터로 차원이 줄어들게 되는 것입니다. Discriminator는 이러한 방식 그대로 작동합니다.

일반적인 CNN, Discriminator에서는 데이터의 차원이 줄어드는데, Generator는 반대로 차원을 확장시켜야 합니다. 그렇다면 여기서 "도대체 어떻게 Generator의 차원을 확장시키는가?"라는 궁금증이 생길 수 있습니다. DCGAN의 경우 De-convolution이라는 방식을 사용해 차원을 확장시킵니다.

### De-convolution?

De-convolution이라는 말을 처음 들어보시는 분도 있을 것 같습니다. Transposed Convolution이라고도 하는데요, 사진을 보면서 알아봅시다. [출처](https://datascience.stackexchange.com/questions/6107/what-are-deconvolutional-layers)

![yycu2](https://user-images.githubusercontent.com/25279765/29484521-7f956986-84fb-11e7-9981-e93afc784f6e.gif)

파란색은 입력이고 초록색은 De-convolution을 거쳐 만들어지는 결과값입니다. 2 x 2의 입력값이 4 x 4로 커지는 것을 보실 수 있습니다. 이런 식으로 deconvolution은 입력의 차원을 확장시켜주는 역할을 하는 것이죠.

DCGAN에 대해 더 알고싶으신 분들은 [이 글](https://angrypark.github.io/DCGAN-paper-reading/)을 참조하세요.


## Implementation

이제 구체적인 구현으로 들어가봅시다. 오늘 사용할 데이터셋은 [CIFAR-10](https://www.cs.toronto.edu/~kriz/cifar.html)이라는 데이터셋입니다. 총 6만개의 32 x 32 이미지가 들어있으며 10개의 클래스(비행기, 자동차, 새, 고양이, 사슴, 개, 개구리, 말, 배, 트럭)가 존재합니다.

자 이제 본격적으로 시작해볼까요?

```python
from __future__ import print_function
import itertools
import math
import time

import torch
from torch import optim
import torchvision
import torch.nn as nn
import torchvision.datasets as dsets
import torchvision.utils as vutils
import torchvision.transforms as transforms
from IPython import display
from torch.autograd import Variable
```

우선 pytorch를 가져옵시다. 그 다음에 필요한 변수들을 선언해줘야합니다

```python
nz = 100 # 노이즈 벡터의 크기
nc = 3 # 채널의 수
ngf = 64 # generator 필터 조정
ndf = 64 # discriminator 필터 조정
niter = 200 # 에폭 수
lr = 0.0002
beta1 = 0.5

imageSize = 64 # 만들어지는 이미지의 크기
batchSize = 64 # 미니배치의 크기
outf = "result"
```

일반적으로 noise 벡터는 100개의 값입니다. 앞에서 설명했듯이 컬러 이미지는 3차원, 채널이 세개이므로 이를 표시해줍니다. 그리고 epoch 수와 learning rate을 지정해줍시다. 또한 만들어지는 이미지들을 저장할 폴더 이름을 설정해줍시다.

그 다음으로 해야할 일은 데이터셋을 불러오는 일이겠죠?

```python
transform = transforms.Compose([
        transforms.Scale(64),
        transforms.ToTensor(),                     
        transforms.Normalize(mean=(0.5, 0.5, 0.5), std=(0.5, 0.5, 0.5))
])

train_dataset = dsets.CIFAR10(root='./data/', train=True, download=True, transform=transform)
train_loader = torch.utils.data.DataLoader(train_dataset, batch_size= batchSize, shuffle=True)
```

아까 위에서 CIFAR 10은 크기가 32 x 32인 이미지라고 했습니다. DCGAN의 경우 일반적으로 64 x 64의 이미지를 사용합니다. 따라서 크기를 맞춰주기 위해 Scale을 해줍니다.

```python
def weights_init(m):
    classname = m.__class__.__name__
    if classname.find('Conv') != -1:         # Conv weight init
        m.weight.data.normal_(0.0, 0.02)
    elif classname.find('BatchNorm') != -1:  # BatchNorm weight init
        m.weight.data.normal_(1.0, 0.02)
        m.bias.data.fill_(0)
```

weigth의 초기값을 설정해주는 코드입니다. Convloution layer의 경우 평균이 0, 표준편차가 0.02인 정규분포에서, Batch normalization의 경우 평균은 1.0 표준편차는 0.02인 layer에서 값을 뽑아냅니다.

데이터셋을 정의했으니 이제 Generator와 Discriminator를 정의하고 학습을 진행하는 것만 남았습니다.

먼저 Generator를 봅시다

```python
class _netG(nn.Module):
    def __init__(self):
        super(_netG, self).__init__()
        self.main = nn.Sequential(

            # 입력값은 Z이며 Transposed Convolution을 거칩니다.
            nn.ConvTranspose2d(nz, ngf * 8, 4, 1, 0, bias=False),
            nn.BatchNorm2d(ngf * 8),
            nn.ReLU(True),

            # (ngf * 8) x 4 x 4
            nn.ConvTranspose2d(ngf * 8, ngf * 4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(ngf*4),
            nn.ReLU(True),

            # (ngf * 4) x 8 x 8
            nn.ConvTranspose2d(ngf * 4, ngf * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(ngf*2),
            nn.ReLU(True),

            # (ngf * 2) x 16 x 16
            nn.ConvTranspose2d(ngf * 2, ngf, 4, 2, 1, bias=False),
            nn.BatchNorm2d(ngf),
            nn.ReLU(True),

            # ngf x 32 x 32
            nn.ConvTranspose2d(ngf, nc, 4, 2, 1, bias=False),
            nn.Tanh()
        )
    def forward(self, input):
        output = self.main(input)
        return output
```

pytorch의 경우 De-convolution을 ConvTranspose라는 이름의 layer로 구현해놓았습니다. ConvTranspose2d(a, b, c, d, e)라고 했을 때 각각의 인자를 설명해드리자면, a는 입력으로 들어오는 채널의 수, b는 만들어지는 결과값의 채널 수, c는 커널의 크기, 즉 Convolution 연산을 수행하는 필터의 크기입니다. d는 stride, e는 padding이 됩니다. [참고](http://pytorch.org/docs/master/nn.html#convtranspose2d)

활성화함수는 ReLU를 사용하며 마지막에 이미지를 만들어낼 때 이외에는 Batch normalization을 적용해줍니다.

```python
class _netD(nn.Module):
    def __init__(self):
        super(_netD, self).__init__()
        self.main = nn.Sequential(
            # (nc) x 64 x 64)
            nn.Conv2d(nc, ndf, 4,2,1,bias=False),
            nn.LeakyReLU(0.2, inplace=True),

            # ndf x 32 x 32
            nn.Conv2d(ndf, ndf * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(ndf * 2),
            nn.LeakyReLU(0.2, inplace=True),

            # (ndf * 2) x 16 x 16
            nn.Conv2d(ndf*2, ndf*4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(ndf * 4),
            nn.LeakyReLU(0.2, inplace=True),

            # (ndf * 4) x 8 x 8
            nn.Conv2d(ndf * 4, ndf * 8, 4, 2, 1, bias=False),
            nn.BatchNorm2d(ndf*8),
            nn.LeakyReLU(0.2, inplace=True),

            nn.Conv2d(ndf*8, 1, 4, 1, 0, bias=False),
            nn.Sigmoid()
        )
    def forward(self, input):
        output = self.main(input)
        return output.view(-1, 1).squeeze(1)
```

그 다음은 Discriminator입니다. 일반적인 CNN을 생각하시면 될 것 같습니다. 이때 Generator와는 다르게 활성화함수로 LeakyReLU를 사용한다는 것에 주의하셔야합니다.

이제 네트워크를 선언해줍시다.

```python
netG = _netG()
netG.apply(weights_init)
print(netG)

netD = _netD()
netD.apply(weights_init)
print(netD)
```

```python
criterion = nn.BCELoss()

input = torch.FloatTensor(batchSize, 3, imageSize, imageSize)
noise = torch.FloatTensor(batchSize, nz, 1, 1)
fixed_noise = torch.FloatTensor(batchSize, nz, 1, 1).normal_(0, 1)
fixed_noise = Variable(fixed_noise)

label = torch.FloatTensor(batchSize)
real_label = 1
fake_label = 0
```

진짜냐 가짜냐, 두 가지를 구분하는 것이므로 loss는 BCELoss가 됩니다. 입력으로 사용할 벡터, noise 벡터를 미리 정의해 줍니다. 또한 학습이 진행되는 과정을 확인해보기 위해 고정된 벡터를 따로 만들어줍니다.

```python
# setup optimizer
optimizerD = optim.Adam(netD.parameters(), lr=lr, betas=(beta1, 0.999))
optimizerG = optim.Adam(netG.parameters(), lr=lr, betas=(beta1, 0.999))
```

이때 학습이 진행되는 과정을 확인해보기 위해 고정된 noise를 만들어줍시다. Optimizer로는 Adam을 사용하겠습니다.

이제 학습을 진행해봅시다.

```python
for epoch in range(epochNum):
    for i, data in enumerate(train_loader):
        # train with real
        netD.zero_grad()
        real_cpu, _ = data
        batch_size = real_cpu.size(0)

        input.resize_as_(real_cpu).copy_(real_cpu)
        label.resize_(batch_size).fill_(real_label)

        inputv = Variable(input)
        labelv = Variable(label)

        output = netD(inputv)
        errD_real = criterion(output, labelv)
        errD_real.backward()
        D_x = output.data.mean()

        # train with fake
        noise.resize_(batch_size, nz, 1, 1).normal_(0, 1)
        noisev = Variable(noise)
        fake = netG(noisev)
        labelv = Variable(label.fill_(fake_label))
        output = netD(fake.detach())
        errD_fake = criterion(output, labelv)
        errD_fake.backward()
        D_G_z1 = output.data.mean()

        errD = errD_real + errD_fake
        optimizerD.step()

        netG.zero_grad()
        labelv = Variable(label.fill_(real_label))
        output = netD(fake)

        errG = criterion(output, labelv)
        errG.backward()
        D_G_z2 = output.data.mean()
        optimizerG.step()
        if ((i+1) % 100 == 0):
            print(i, "step")
            fake = netG(fixed_noise)
            vutils.save_image(fake.data,
            '%s/fake_samples_epoch_%s.png' % (outf, str(epoch)+" "+str(i+1)),
            normalize=True)
    vutils.save_image(real_cpu,
            '%s/real_samples.png' % outf,
            normalize=True)
    fake = netG(fixed_noise)
    vutils.save_image(fake.data,
            '%s/fake_samples_epoch_%s.png' % (outf, epoch),
            normalize=True)
    result_dict = {"loss_D":loss_D,"loss_G":loss_G,"score_D":score_D,"score_G1":score_G1,"score_G2":score_G2}

    # do checkpointing
    torch.save(netG.state_dict(), '%s/netG.pth' % (outf))
    torch.save(netD.state_dict(), '%s/netD.pth' % (outf))
```

epochNum에 원하는 에폭 수를 넣어주시면 됩니다. 또한 100번째 배치마다 이미지를 저장합니다.

학습 과정에서 나온 이미지들은 다음과 같습니다.

![fake_samples_epoch_66](https://user-images.githubusercontent.com/25279765/29802560-097532f0-8cb1-11e7-8e21-115ebbd13df3.png)

![fake_samples_epoch_86](https://user-images.githubusercontent.com/25279765/29802564-0d2055e2-8cb1-11e7-82b7-c1512f8e4651.png)

완전한 이미지를 만들어내지는 못하지만 그래도 어느정도 물체를 알아볼 수는 있는 정도입니다.

## Conclusion

오늘은 CIFAR-10 데이터셋을 이용해 DCGAN을 학습시켜보았습니다. DCGAN을 학습시키는데에는 많은 컴퓨팅 파워가 필요함에 주의하세요.
