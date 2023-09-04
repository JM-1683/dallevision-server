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
const port = process.env.PORT || 8000; //will move to .env at some point
const cycleTime = process.env.CYCLE_TIME || 30000; //time in ms to restart the image generation/archive process. 


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
                    database: process.env.DB_NAME
                });
                const promisePool = pool.promise();
                return promisePool;
            } catch (err) {
                console.log(err);
            }
        }

        //This is passed into all the various functions/routes that require the DB connection
        app.locals.dbConnection = await startDbConnection();

        //This function will kill the connection pool when the script receives certain signals.
        //If anything hangs, it will terminate after five seconds.
        const cleanExit = () => {
            if (app.locals.dbConnection) {
                app.locals.dbConnection.end(err => {
                    if (err) {
                        console.error('Error while closing the database connection:', err);
                    } else {
                        console.log('Database connection closed.');
                    }
                    process.exit();
                });

                // This forces an exit if the connection doesn't close within a given time
                setTimeout(() => {
                    console.error('Forcefully terminating process after waiting for database to close.');
                    process.exit(1);
                }, 7000);  //7 seconds in milliseconds
            } else {
                process.exit();
            }
        }

        //the aforementioned signals
        process.on('SIGINT', cleanExit);
        process.on('SIGTERM', cleanExit);
        process.on('exit', cleanExit);

        //The initialization of the main loop. 
        initialize = async () => {
            try {
                //console.log("Initializing ...");
                //console.log("Clearing 'CURRENT' directory ...");
                await directoryCheck('./images/current/');
                //console.log("Starting DB connection ...");
                const databaseConnection = app.locals.dbConnection;
                //console.log("DB connection successful.");

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
                const query = req.body.ID;
                console.log(query);
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
        // ... [rest of your code before the /getImage route]

        app.get('/getImage', async (req, res) => {
            try {

                //Date variables are declared for the creation of contemporary directories
                const date = new Date();
                const MM = String(date.getMonth() + 1).padStart(2, '0');
                const DD = String(date.getDate()).padStart(2, '0');
                const YYYY = date.getFullYear();
                const fullDir = `./images/${YYYY}/${MM}/${DD}/`;

                //Checks if directory exists. If it does, get the file count. Otherwise, set it to 0.
                const directoryCount = (await pathExists(fullDir)) ? await countDirectoryFiles(fullDir) : 0;

                let output; //Sent at the very end; changes based on conditions

                //As long as the contemporary directory has any number of files in it,
                if (directoryCount != 0) {
                    //it will grab all of the file names in that directory.
                    const items = await fs.readdir(fullDir);
                    console.log(`\nThe Items being read: ${items}\n`);
                    //They are then sorted out from lowest number to highest,
                    items.sort((a, b) => grabFileNumber(a) - grabFileNumber(b));
                    console.log(`The items after sort: ${items}\n`);
                    //and only the last three filesnames are kept and assigned to three variables.
                    const [newPicture, newPrompt, newStory] = items.slice(-3);
                    //The three variables are assigned the paths of the content made in the most recent generation
                    const filePathPrompt = path.join(__dirname, 'images', `${YYYY}`, `${MM}`, `${DD}/` + newPrompt);
                    const filePathStory = path.join(__dirname, 'images', `${YYYY}`, `${MM}`, `${DD}/` + newStory);
                    const filePathImage = path.join(__dirname, 'images', `${YYYY}`, `${MM}`, `${DD}/` + newPicture);
                    console.log(`filePathPicture: ${filePathImage}`);
                    //An ID is defined as a combination of the day's date and the filenumber
                    let ID = `${YYYY}${MM}${DD}_${newPicture}`;
                    ID = ID.slice(0, -5);
                    console.log(`ID: ${ID}`);
                    //The image terms and story are read from the files with the filepaths passed into readFile
                    const terms = await fs.readFile(filePathPrompt, 'utf8');
                    const textStory = await fs.readFile(filePathStory, 'utf8');

                    //And, finally, all of the content is packaged and sent to the client
                    output = {
                        image: imageToBase64(filePathImage), //sent as Base64 and "re-assembled" clientside
                        imageTerms: terms,
                        story: textStory,
                        ID: ID //The ID is passed to the client, which uses it in the upvote submission process
                    }
                    //Now, if the directoryCount really is zero, there's nothing to send. A generation is in the process of happening,
                    //so until content is generated and archived, the contents of ./images/waiting/ will be sent: a picture of an hourglass
                    //and a short message recommending patience.
                } else {
                    const filePathWaiting = path.join(__dirname, 'images', 'waiting', 'waiting.png');
                    const message = "Still generating the day's first picture. Please wait another minute at most.";

                    output = {
                        image: imageToBase64(filePathWaiting),
                        imageTerms: '“Have patience with all things but first of all with yourself.” — St Francis de Sales',
                        story: message,
                        ID: "00000"
                    };
                }

                res.send(output);
            } catch (err) {
                console.log(err);
            }
        });

        // ... [rest of your code after the /getImage route]

        //self explanatory
        app.listen(port, async () => {
            try {
                //console.log(`Server successfully listening on port ${port}.`);
            } catch (err) {
                console.log(err);
            }
        });
    } catch (err) {
        console.log(err);
    }
}

Server();
