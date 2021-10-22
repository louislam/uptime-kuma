# Ansible Playbook to install uptime kuma using docker

This playbook comes with three roles

    1. docker (to install docker)
    2. nginx (to install nginx using docker with ssl)
    3. uptime kuma (to install uptime kuma using docker)

To see more info see docker-compose, tasks and config files 
I will try to make this readme better

## To run it
1. run `ansible-galaxy install -r ansible-requirements.yml` to get requirements
2. prepare inventory hosts
3. to run playbook
```bash
ansible-playbook ./playbook.yml -i <your inventory path> --extra-vars "kuma_domain=<uptime kuma domain>"
```
you can use other ansible playbook options too
