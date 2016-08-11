/*
Represents a file that we wish to upload to reddit.

All files have a name, mimeType, and data. 

In the browser data can be a `File` object directly from
a file input, or a `Blob` object.

In node, data can be a `utf8` string, or a buffer
containing the content of the file.
*/

export default function(name, mimeType, data) {
  var self = {};

  self.name = name;
  self.mimeType = mimeType;

  if (typeof File !== 'undefined' && data instanceof File ||
      typeof Blob !== 'undefined' && data instanceof Blob) {
    self.data = data;
  } else {
    self.data = (typeof data === 'string') ? new Buffer(data) : data;
  }

  return self;
}
