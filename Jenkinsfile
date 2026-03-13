// Pipeline: agent Node 18 → checkout → node/npm version → install deps → testes → build → push Docker Hub
// Testes rodam no container node:18; Build e Push rodam em agente com Docker.

pipeline {
  agent none

  stages {

    stage('Test') {
      agent {
        docker {
          image 'node:18'
        }
      }

      steps {
        sh 'node -v'
        sh 'npm -v'

        dir('src') {
          sh 'npm install'
          sh 'npm test'
        }
      }
    }

    stage('Build Docker') {
      agent any
      steps {
        sh 'docker build -t app:latest .'
      }
    }

    stage('Push to Docker Hub') {
      agent any
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'dockerhub-credentials',
          usernameVariable: 'DOCKER_USER',
          passwordVariable: 'DOCKER_PASS'
        )]) {
          sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
          sh 'docker tag app:latest $DOCKER_USER/jenkins-pipeline-test:latest'
          sh 'docker push $DOCKER_USER/jenkins-pipeline-test:latest'
        }
      }
    }

  }
}
