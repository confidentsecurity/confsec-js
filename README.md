# CONFSEC JavaScript/TypeScript SDK

## Overview

The CONFSEC JavaScript/TypeScript SDK provides developers with a convenient way
to make secure and anonymous AI inference requests via CONFSEC. It can function
as a drop-in replacement for existing OpenAI clients, or as an HTTP client for
lower-level access to the CONFSEC API. Using the SDK, programs can make requests
without the need to deploy and manage the CONFSEC proxy.

## Installation

```bash
npm install @confidentsecurity/confsec
```

## Quickstart

Use our OpenAI wrapper as a drop-in replacement for existing OpenAI clients:

```javascript
// Use OpenAI wrapper
import { OpenAI } from '@confidentsecurity/confsec';
const client = new OpenAI();
```

Or, for lower-level access, use the CONFSEC-enabled `fetch` implementation directly:

```javascript
// Use fetch implementation
import { ConfsecClient } from '@confidentsecurity/confsec';

const client = new ConfsecClient({ apiKey: process.env.CONFSEC_API_KEY });
const confsecFetch = client.getConfsecFetch();
// Use confsecFetch for requests...
client.close();
```

## Configuration

We aim to make the SDK as config-free as possible. However, there are some
parameters you can optionally configure to control how the client interacts
with the CONFSEC backend:

- `concurrentRequestsTarget (number)`: Allows the client to specify the desired
  request parallelism. This primarily impacts the number of credits that the
  client will maintain cached and available to use immediately. Higher values
  for this parameter will increase the maximum request throughput that the
  client can achieve, but also increases the amount of credits that may be lost
  permanently if the client process terminates without properly closing the
  client.
- `defaultNodeTags (string[])`: Allows the client to specify default filters
  for CONFSEC compute nodes that will be applied to all requests. Users should
  not need to configure this in most cases, especially when using the OpenAI
  wrapper, since the `model` field of any request will be automatically mapped
  to the appropriate CONFSEC node tags.

## Usage

### OpenAI Wrapper

The `OpenAI` class can be initialized explicitly with an API key, by passing the
`apiKey` parameter to the constructor. Otherwise, it will attempt to load the
API key from the `CONFSEC_API_KEY` environment variable.

It is very important to call `client.close()` when you are done with the client
to ensure that all resources are properly released. This can be done explicitly,
or by using the client in a try/finally block. Failure to do so may result
in credits being lost.

Currently, the following subset of APIs are supported:

- Completions
- Chat

```javascript
import { OpenAI } from '@confidentsecurity/confsec';

const client = new OpenAI();

try {
  const stream = await client.chat.completions.create({
    model: 'deepseek-r1:1.5b',
    messages: [
      {
        role: 'user',
        content: 'What is the meaning of life?',
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
} finally {
  client.close();
}
```

### `fetch` Implementation

The `ConfsecClient` class can also be initialized explicitly for lower-level
access to the CONFSEC API. It's recommended to get a fetch function using the
`getConfsecFetch` method of the `ConfsecClient` class which will use the client
as the transport, instead of calling `ConfsecClient`'s methods directly. This
function returns a function which can be used as a drop-in replacement for the
global `fetch` function.

As with the `OpenAI` class, it is very important to call `client.close()` when
you are done with the client to ensure that all resources are properly released.
This should be done explicitly in a try/finally block. Failure to do so may
result in credits being lost.

```javascript
import { ConfsecClient } from '@confidentsecurity/confsec';

const client = new ConfsecClient({ apiKey: process.env.CONFSEC_API_KEY });

try {
  const confsecFetch = client.getConfsecFetch();
  const response = await confsecFetch(
    // Important: the base URL must be set to "https://confsec.invalid"
    'https://confsec.invalid/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-r1:1.5b',
        messages: [{ role: 'user', content: 'What is the meaning of life?' }],
      }),
    }
  );
  const data = await response.json();
  console.log(data);
} finally {
  client.close();
}
```

## License

This package is licensed under the Confident Security Limited License. See [LICENSE](./LICENSE) for details.
