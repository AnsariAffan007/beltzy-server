var axios = require('axios');
var FormData = require('form-data');

async function imageUploader(file, res) {

  var data = new FormData();
  data.append('image', file.data);
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://api.imgur.com/3/image',
    headers: {
      Authorization: 'Client-ID ' + process.env.IMGUR_CLIENT_ID,
      ...data.getHeaders()
    },
    data: data
  };
  
  const response = await axios(config);
  if (response) {
    let imageUrl = response.data.data.link;
    let hash = response.data.data.deletehash;
    return { imageUrl, hash };
  }
}

module.exports = imageUploader;
