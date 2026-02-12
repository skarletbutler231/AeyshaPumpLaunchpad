exports.debug = (category, args) => {
    console.log(`[${(new Date()).toUTCString()}], category: ${category}, content: ${args}`)
}

exports.warn = (category, args) => {
    console.warn(`[${(new Date()).toUTCString()}], category: ${category}, content: ${args}`)
}

exports.error = (category, args) => {
    console.error(`[${(new Date()).toUTCString()}], category: ${category}, content: ${args}`)
}