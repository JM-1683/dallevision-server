//Secure the misc.json file serverside -- only the specific docker container should have access to it, and the root acct

//Uses Google Secrets Manager to retrieve the API key.

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
require('dotenv').config();

const client = new SecretManagerServiceClient();

const getApiKey = async () => {
    try {
        const secretName = process.env.OPEN_API_PATH;
        const [version] = await client.accessSecretVersion({
            name: secretName,
        });
        const Key = version.payload.data.toString('utf8');
        return Key;
    } catch (err) {
        console.log(err);
    }
}

const getDbLogin = async () => {
    try {
        const secretName = process.env.DB_PATH;
        const [version] = await client.accessSecretVersion({
            name: secretName,
        });
        const data = version.payload.data.toString('utf8');
        const Key = data.split('/');
        return Key;
    } catch (err) {
        console.log(err);
    }
}


module.exports = {
    getApiKey, getDbLogin
}