const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const { getApiKey } = require('./getApiKey');
const { buildPrompt } = require('./buildPrompt');

const dlDir = './images/current/';

// Utility function to save image to file using streams and promises
const saveImageToFile = (dataStream, path) => {
  return new Promise((resolve, reject) => {
      const fileWrite = fs.createWriteStream(path);
      dataStream.pipe(fileWrite)
                .on('finish', resolve)
                .on('error', reject);
  });
}

// Queries OpenAPI for images based on the prompts returned when buildPrompt() is called
const getImages = async () => {
  try {
    const Key = await getApiKey();
  
    const openai = new OpenAI({
      apiKey: Key
    });
  
    const Prompt = await buildPrompt();
  
    // DALLE is queried to make an image.
    // 512x512 is the current size to keep costs low(er)
    const Images = await openai.images.generate({
      prompt: Prompt.toString(),
      n: 1,
      size: "512x512",
    });
  
    // A download link to the picture is returned.
    const link = Images.data[0].url;
    // Download the picture from the link
    const file = await axios.get(link, {
      responseType: 'stream'
    });
  
    // Write the picture to a file
    const filePath = dlDir + "current.jpg";
    await saveImageToFile(file.data, filePath);

  } catch (err) {
    console.log("Error building images with DALLE2: " + err);
  }
}

// This converts the image to base64, used by the server to transmit the jpg.
// This is done so other objects of type txt can be transmitted all at once in the same object
const imageToBase64 = (filePath) => {
  try {
    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');
    return base64Image;
  } catch (error) {
    console.log(error);
    return error;
  }
}

module.exports = {
  getImages: getImages,
  imageToBase64: imageToBase64
}
