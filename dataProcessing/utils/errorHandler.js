// errorHandler.js
module.exports = {
    handle: function(error, context) {
        // Error handling logic
        console.error(`Error in ${context}:`, error);
        // Other error handling actions
    }
};
