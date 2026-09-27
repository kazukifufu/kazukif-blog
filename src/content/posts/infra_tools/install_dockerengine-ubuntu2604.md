---
title: "Ubuntu 26.04 LTSへのDocker Engineの導入"
date: "2026-09-27"
category: "infra_tools"
---

- Docker Engineの導入
  - [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)の手順に従い導入する。導入の主なステップは下記の通りとなる。
    - 前提の確認 
    - Dockerのaptリポジトリの設定
    - Dockerパッケージの導入
    - Dockerパッケージ導入の検証
      ```bash
      $ docker run hello-world
      Unable to find image 'hello-world:latest' locally
      latest: Pulling from library/hello-world
      4f55086f7dd0: Pull complete 
      d5e71e642bf5: Download complete 
      Digest: sha256:5e23090353324d887c48ad5e5c56d294eab81588df9605b07d1afe895f9cc8f8
      Status: Downloaded newer image for hello-world:latest

      Hello from Docker!
      This message shows that your installation appears to be working correctly.

      To generate this message, Docker took the following steps:
      1. The Docker client contacted the Docker daemon.
      2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
          (amd64)
      3. The Docker daemon created a new container from that image which runs the
          executable that produces the output you are currently reading.
      4. The Docker daemon streamed that output to the Docker client, which sent it
          to your terminal.

      To try something more ambitious, you can run an Ubuntu container with:
      $ docker run -it ubuntu bash

      Share images, automate workflows, and more with a free Docker ID:
      https://hub.docker.com/

      For more examples and ideas, visit:
      https://docs.docker.com/get-started/
      
      ```
    - [rootユーザー以外から実行可能にするための設定](https://docs.docker.com/engine/install/linux-postinstall/)
  

- Docker EngineからのGPUを使用するための設定(導入先のPCにNVIDIAのGPUが搭載されているため)
  - [Installing the NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)の[With apt: Ubuntu, Debian](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#with-apt-ubuntu-debian)の手順に従い導入し、[Running a Sample Workload with Docker](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/sample-workload.html#running-a-sample-workload-with-docker)に従い導入を検証する


- 注意点
  - Docker Engineとファイアウォール(UFW)のルールは相互連携しない。このため、コンテナでポートを公開した場合、コンテナへとコンテナからのトラフィックはUFWのルールを迂回される (参照: [Docker and ufw](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw))
