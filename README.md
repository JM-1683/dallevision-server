# dallevision-server
An Express.JS server that dynamically generates themed image-story pairs and serves them to a client-side interface.

DalleVision-server autonomously generates (currently just fantasy-)themed image-story pairs, and a rudimentary system to process upvotes on said pairs.

Required is an OpenAI account with API access, and a MySQL database to store image data, plus number of upvotes. 

One will see in server.js, lines 40-48, the environmental vars required for `host`, `port`, and so on. User/Pass are taken from a JSON file with Google Secret Manager auth information not incldued in this repo, so one must change those / refactor the code to make that work.

By default, a new generation completes every 30 seconds. It's possible to change this by passing the environmental variable `CYCLE_TIME=(number of milliseconds)`, but due to much of the code's asynchronous nature, it isn't recommended that one goes below the 30 second threshold. Otherwise, you may face file read/write issues due to files being missing, moved, etc due to them not yet being generated when they're called for.

The application is, by default, executed on port 8000. This is nonetheless dictated by the env var PORT.

To start, run `node server.js` (add in whatever environmental vars you see fit). The file generation sequences will start, and any client-side application will be able to hit the API endpoints /getImages and /vote.

The next commit or so will include a better logging system, more comprehensively-defined routes, and other features.

A Dockerfile for building an image has been included.
