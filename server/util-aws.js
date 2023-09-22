const AWS = require("aws-sdk");

exports.restartInstance = async (instanceID) => {
    const ec2 = new AWS.EC2({ region: "ap-northeast-1" });

    return new Promise((resolve, reject) => {
        const params = {
            InstanceIds: [ instanceID ],
        };

        ec2.rebootInstances(params, (err, data) => {
            if (err) {
                console.log(err, err.stack);
                reject(err);
            } else {
                console.log(data);
                resolve(data);
            }
        });
    });
};
