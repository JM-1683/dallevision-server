//Various functions relating to DB queries used for storing prompts and stories
//for generated images, plus their upvotes.
const mysql = require('mysql2');

const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const queryRetries = 3; //The number of retries a query attempt will make before timing out

const retry = async (fn, maxRetries = queryRetries) => {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            await fn();
            return; // If successful, return early
        } catch (err) {
            await delay(3000);
            attempts++;
            console.log(`Attempt ${attempts} failed. Retrying...`);
        }
    }
    throw new Error(`Failed after ${maxRetries} attempts.`);
};

const executeQuery = async (connection, query, data) => {
    console.log("Executing query ...")
    console.log("QUERY: " + query);
    console.log("QUERY DATA: " + data);
    try {
        await connection.execute(query, data);
    } catch (err) {
        console.error("Error executing query:", err);
        throw err;
    }
};


//Takes image data (image ID, story, prompt terms used) and stores it into the DB.
const commitToTable = async (connection, picture) => {
    return retry(async () => {
        if (!connection) {
            console.log("Connection bad/not established.")
            throw new Error("Connection bad/not established.");
        }

        // Use parameterized queries instead of string interpolation for added security.
        const addQuery = `
            INSERT INTO DallevisionRanking (pictureID, prompt, story, upvotes)
            VALUES (?, ?, ?, ?)
        `;
        const params = [picture.ID, picture.imageTerms, picture.story, 1];
        console.log("EXECUTING QUERY ...")
        await executeQuery(connection, addQuery, params);
        console.log("Successful write.");
    });
};

//Takes an upvote from client side and stores it into the DB.
const submitUpvote = async (connection, ID) => {
    try {
        console.log("ID:" + ID);
        return retry(async () => {
            if (!connection) {
                throw new Error("Connection bad/not established.");
            }
            console.log("GOOD CONNECTION at submitUpvote");
            const incrementQuery = `UPDATE DallevisionRanking SET upvotes = upvotes + 1 WHERE pictureID = ?`;
            console.log("SENDING INCREMENT")
            await executeQuery(connection, incrementQuery, [ID]);
            console.log("Successful write.");
        });
    } catch (err) {
        console.log(err);
    }
};

module.exports = {
    submitUpvote, commitToTable
}
