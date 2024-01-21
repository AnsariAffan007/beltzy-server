const imgur = require('imgur');
const fs = require('fs');
const util = require('util');

async function imageUploader(file, res) {
  let uploadPath = 'uploads/' + file.name;

  const mvPromise = util.promisify(file.mv);

  try {
    await mvPromise(uploadPath);
    const urlObject = await imgur.uploadFile(uploadPath);
    fs.unlinkSync(uploadPath);
    const imageUrl = urlObject.data.link;
    const hash = urlObject.data.deletehash;
    return { imageUrl, hash };
  }
  catch (err) {
    fs.unlinkSync(uploadPath);
    res.status(500).send({ message: "Couldn't upload Image! Please try again" })
  }
}

module.exports = imageUploader;
