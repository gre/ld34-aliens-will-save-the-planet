
const image = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onerror = reject;
  img.onabort = reject;
  img.onload = () => resolve(img);
  img.src = src;
});
const images = (...srcs) => Promise.all(srcs.map(image));
module.exports = { image, images };
