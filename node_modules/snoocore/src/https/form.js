
import querystring from 'querystring';

import when from 'when';

export function getSectionBoundary(boundary) {
  return '--' + boundary;
}

export function getEndBoundary(boundary) {
  return '--' + boundary + '--';
}

export function encodeFieldPart(boundary, key, value) {
  return new Buffer([
    getSectionBoundary(boundary),
    '\r\n',
    'Content-Disposition: form-data; name="' + key + '"',
    '\r\n\r\n',
    value,
    '\r\n'
  ].join(''));
}

export function encodeFilePart(boundary, key, name, mimeType, data) {
  return Buffer.concat([
    new Buffer([
      getSectionBoundary(boundary),
      '\r\n',
      ('Content-Disposition: form-data; ' +
       'name="' + key + '"; ' +
       'filename="' + name + '"'),
      '\r\n',
      'Content-Type: ' + mimeType,
      '\r\n\r\n'
    ].join('')),
    data, // already a buffer
    new Buffer('\r\n')
  ]);
}

/*
   Converts a list of parameters to form data

   - `fields` - a property map of key value pairs
   - `files` - a list of property maps of content
   --> `type` - the type of file data
   --> `keyname` - the name of the key corresponding to the file
   --> `valuename` - the name of the value corresponding to the file
   --> `dataBuffer` - A buffer containing the files data
 */
export function getMultipartFormData(boundary, fields, files) {

  var dataBuffer = new Buffer(0);
  var key;

  if (fields) {
    for (key in fields) {
      // skip over any file fields
      if (key === 'file') { continue; }

      var value = fields[key];

      dataBuffer = Buffer.concat([
        dataBuffer, encodeFieldPart(boundary, key, value)
      ]);
    }
  }

  if (files) {
    for (key in files) {
      var file = files[key];

      dataBuffer = Buffer.concat([
        dataBuffer,
        encodeFilePart(boundary,
                       file.key,
                       file.name,
                       file.mimeType,
                       file.data)
      ]);
    }
  }

  // close with a final boundary closed with '--' at the end
  dataBuffer = Buffer.concat([
    dataBuffer,
    new Buffer(getEndBoundary(boundary))
  ]);

  return dataBuffer;
}

/*
   Takes an existing string or key-value pair that represents form data
   and returns form data in the form of an Array.

   If the formData is an object, and that object has a 'file' key,
   we will assume that it is going to be a multipart request and we
   will also assume that the file is actually a file path on the system
   that we wish to use in the multipart data.
 */
export function getData(formData) {

  var data = {
    contentType: 'application/x-www-form-urlencoded',
    contentLength: 0,
    buffer: new Buffer(0)
  };

  // The data is already in a string format. There is nothing
  // to do really
  if (typeof formData === 'string') {
    data.buffer = new Buffer(formData);
  }

  if (typeof formData === 'object') {
    // The data is an object *without* a file key. We will assume
    // that we want this data in an url encoded format
    if (!formData.file) {
      data.buffer = new Buffer(querystring.stringify(formData));
    } else {
      // for now we only have to handle one file, with one key name of 'file'
      var singleFile = formData.file;
      singleFile.key = 'file';

      var files = [ formData.file ];

      var boundary = '---------Snoocore' + Math.floor(Math.random() * 10000);
      data.contentType = 'multipart/form-data; boundary=' + boundary;
      data.buffer = getMultipartFormData(boundary, formData, files);
    }
  }

  data.contentLength = data.buffer.length;
  return data;
}

/*
   Takes an key-value pair and turns them into a FormData object. This is for when
   we want to upload a file using XMLHttpRequest.
*/

export function getFormData(formData) {
  var data = new FormData();

  for (var key in formData) {
    if (key === 'file') {
      data.append(key, formData[key].data, formData[key].name);
    } else {
      data.append(key, formData[key]);
    }
  }

  return data;
}
