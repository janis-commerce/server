# Server

![Build Status](https://github.com/janis-commerce/server/workflows/Build%20Status/badge.svg)
[![npm version](https://badge.fury.io/js/%40janiscommerce%2Fserver.svg)](https://www.npmjs.com/package/@janiscommerce/server)

A package for managing a Server with HTTP Server. This package implements the [express](https://www.npmjs.com/package/express).

## Installation

```
npm install @janiscommerce/server
```

## Usage

```js
const Server = require('@janiscommerce/server');

const AuthClass = require('./src/controllers/authorization');

new Server({
	validateSchemas: true,
	cors: {
		origin: true,
		credentials: true
	},
	authorizationClass: AuthClass
});
```

### options

Use this options to configurate the server instance

| Option | Type | Description | Attributes | Default value |
|--------|------|-------------|------------|---------------|
| validateSchemas | boolean | Indicates if the server has to validate the api schemas | | false |
| cors | object | Used to implement APIs [Cors](https://www.npmjs.com/package/cors) configuration as custom props. If options is `undefined` or set to `true` it will use the default CORS config for every property.| | [See below](#cors-default) |
| authorizationClass | object | A class that implements the authorization logic | | |

#### CORS Default:

```js
{
	origins: ['*'],
	headers: [
		'authorization',
		'content-type',
		'janis-api-key',
		'janis-api-secret',
		'janis-client',
		'janis-service',
		'janis-entity',
		'x-api-key',
		'x-janis-page',
		'x-janis-page-size'
	],
	allowCredentials: true,
	maxAge: 600
}
```