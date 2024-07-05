pipeline{
    agent any
    tools{
        jdk "jdk17"
        nodejs "node18"
    }
    environment{
        SCANNER_HOME=tool 'sonar-scanner'
    }
    stages {
        stage('checkout from Git'){ 
            steps{
                git branch: 'master', url: 'https://github.com/MOHANBV153/uptime-kuma.git' 
           }
       }
        stage('install dependencies'){
            steps{
                sh "npm install"
            }
        }
        stage('sonarqube analysis'){
            steps{
                withSonarQubeEnv('Sonar-token'){
                    sh ''' $SCANNER_HOME/bin/sonar-scanner -Dsonar.projectName=Uptime \
                    -Dsonar.projectKey=Uptime '''
                }
            }
        }
        stage("quality gate"){
           steps {
                script {
                    waitForQualityGate abortPipeline: false, credentialsId: 'Sonar-token' 
                }    
           }
        }   
        stage('OWASP FS SCAN') {
            steps{
                dependencyCheck additionalArguments: '--scan ./ --disableYarnAudit --disableNodeAudit', odcInstallation: 'DP-Check'
                dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
            }
        }
        stage('TRIVY FS SCAN') {
            steps{
                sh "trivy fs . > trivyfs.json"
            }
        }
        stage("Docker Build & Push"){
            steps{
                script{
                    withDockerRegistry(credentialsId: 'Dockerhub', toolName: 'docker'){
                        sh "docker build -t Uptime"
                        sh "docker tag Uptime monishdockerhub/Uptime:latest"
                        sh "docker push monishdockerhub/Uptime:latest"
                    }
                }   
            }
        }
        stage("TRIVY IMAGE SCAN"){
            steps{
                sh "trivy image monishdockerhub/Uptime:latest > trivy.json"    
            }
        }        
        stage("Remove container") {
            steps{
                sh "docker stop Uptime | true"
                sh "docker rm Uptime | true"    
            }
        }
        stage('Deploy to Container'){
            steps{
                sh docker run -d --name Uptime -v /var/run/docker.sock:/var/run/docker.sock -p 3001:3001 monishdockerhub/Uptime:latest 
            }            
        }
    }
}       