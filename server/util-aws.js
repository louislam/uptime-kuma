const AWS = require("aws-sdk");

exports.restartInstance = async (instanceID, environment) => {

    const credential = {
        "Production": {
            accessKeyId: process.env.PROD_AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.PROD_AWS_SECRET_ACCESS_KEY,
        },
        "Evaluation": {
            accessKeyId: process.env.EVAL_AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.EVAL_AWS_SECRET_ACCESS_KEY,
        }
    }[environment];

    const ec2 = new AWS.EC2({
        region: "ap-southeast-1",
        ...credential,
    });

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
