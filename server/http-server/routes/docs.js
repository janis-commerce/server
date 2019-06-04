'use strict';

const express = require('express');

module.exports = app => {
	app.use('/docs', express.static('jsdocs'));
};
