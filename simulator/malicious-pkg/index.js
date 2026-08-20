// Benign utility functions to make the package look legitimate
module.exports = {
  version: "1.0.0",
  greet: (name) => `Hello, ${name}!`,
  formatDate: (date = new Date()) => date.toISOString()
};
