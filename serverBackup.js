//The main server.
const express = require('express');
const fs = require('fs').promises; // I prefer to use promise-based fs operations instead of callback or sync
const cors = require('cors');
const path = require('path');
const { getImages, imageToBase64 } = require('./buildImages');
const { archiveBroadcast, countDirectoryFiles, grabFileNumber, directoryCheck } = require('./archiveBroadcast');
const { submitUpvote } = require('./sql')
const { getDbLogin } = require('./getApiKey');
const mysql = require('mysql2');

const app = express();
const port = 8000; //will move to .env at some point
const cycleTime = 30000; //time in ms to restart the image generation/archive process. 


//All of the Express routes are wrapped in an async server, as certain async functions are called between routes
const Server = async () => {

    //pathExists function
    try {
        const pathExists = async (path) => {
            try {
                await fs.access(path);
                return true;
            } catch {
                return false;
            }
        }

        //Cross Origin Resource Sharing enabled, can be restricted more down the line
        const corsOptions = {
            methods: "GET, POST",
            allowedHeaders: ['Content-Type', 'Authorization'] //Research other corsOptions methods
        }
        app.use(cors(corsOptions));
        app.use(express.json());

        //This starts the DB connection
        const startDbConnection = async () => {
            try {
                const dbKey = await getDbLogin();
                const pool = mysql.createPool({
                    host: process.env.DB_HOST,
                    port: process.env.DB_PORT,
                    user: dbKey[0],
                    password: dbKey[1],
                    database: 'defaultdb',
                });
                const promisePool = pool.promise();
                return promisePool;
            } catch (err) {
                console.log(err);
            }
        }

        app.locals.dbConnection = await startDbConnection();

        //The initialization of the main loop. 
        const initialize = async () => {
            try {
                console.log("Initializing ...");
                console.log("Clearing 'CURRENT' directory ...");
                await directoryCheck('./images/current/');
                console.log("Starting DB connection ...");
                const databaseConnection = await startDbConnection();
                console.log("DB connection successful.");

                //These two are called before setInterval so activity can start right away
                await archiveBroadcast(databaseConnection);
                await getImages();
                setInterval(async () => {
                    //Before getting any images, anything left over in ./images/current will be archived
                    await archiveBroadcast(databaseConnection);
                    //Then, new images are retrieved
                    await getImages();
                }, cycleTime)
            } catch (err) {
                console.log(err);
            }
        }

        initialize(); //Initialization invoked

        //This route handles incoming upvotes
        app.post('/vote', async (req, res) => {
            try {
                console.log("Upvote retrieved.")
                const query = req.body.data;
                const dbConnection = req.app.locals.dbConnection; // Accessing the connection from app.locals
                if (!dbConnection) {
                    throw new Error('Database connection not initialized.');
                }
                await submitUpvote(dbConnection, query);
                res.send({
                    'success': true,
                    'message': "Vote submitted!"
                })
                console.log("Upvote sent to server.");
            } catch (err) {
                console.log(err);
                res.status(500).send('Internal Server Error');
            }
        })


        //the frontend hits the endpoint getImage to retrieve the image, the story, and the image creations terms.
        //imageToBase64 will hit the requested-for image and convert it. The picture is committed to the database and
        //all are returned clientside in an object `output`
        app.get('/getImage', async (req, res) => {
            try {
                //Date variables are declared / formatted for contemporary directory creation
                const date = new Date();
                const MM = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
                const DD = String(date.getDate()).padStart(2, '0');
                const YYYY = date.getFullYear();
                const fullDir = `./images/${YYYY}/${MM}/${DD}/`;

                //directoryCount is 0 if a directory for the current date (./images/YYYY/MM/DD) doesn't exist.
                let directoryCount;
                const pathCheck = await pathExists(fullDir);
                if (pathCheck == false) {
                    directoryCount = 0;
                    //If the directory does exist, it will take a count of the files therein.
                } else {
                    directoryCount = await countDirectoryFiles(fullDir);
                }
                if (directoryCount > 0) {
                    const items = await fs.readdir(fullDir);
                    items.sort((a, b) => grabFileNumber(a) - grabFileNumber(b));
                    const [newPicture, newPrompt, newStory] = items.slice(-3);
                    const filePathPrompt = path.join(__dirname, 'images', `${YYYY}`, `${MM}`, `${DD}/` + newPrompt);
                    const filePathStory = path.join(__dirname, 'images', `${YYYY}`, `${MM}`, `${DD}/` + newStory);
                    const filePathImage = path.join(__dirname, 'images', `${YYYY}`, `${MM}`, `${DD}/` + newPicture);
                    const ID = `${YYYY}${MM}${DD}_${newPicture[0]}`;

                    const terms = await fs.readFile(filePathPrompt, 'utf8');
                    const textStory = await fs.readFile(filePathStory, 'utf8');

                    const output = {
                        image: imageToBase64(filePathImage),
                        imageTerms: terms,
                        story: textStory,
                        ID: ID
                    }
                    res.send(output);
                } else {
                    const filePathWaiting = path.join(__dirname, 'images', 'waiting', 'waiting.png');
                    const message = "Still generating the day's first picture. Please wait another minute at most."
                    const waiting = {
                        image: imageToBase64(filePathWaiting),
                        imageTerms: 'Just be patient.',
                        story: message,
                        ID: "00000"
                    }
                    res.send(waiting)
                }
            } catch (err) {
                console.log(err); // Replaced "error" with "err" to match the catch block variable
            }
        })

        //self explanatory
        app.listen(port, async () => {
            try {
                console.log(`Server successfully listening on port ${port}.`);
            } catch (err) {
                console.log(err);
            }
        });
    } catch (err) {
        console.log(err);
    }
}

Server();
