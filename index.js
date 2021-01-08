// Serve different variants of your site to different visitors
addEventListener('fetch', event => {
  event.respondWith(fetchAndApply(event.request))
})

// psuedo-enum implementation
const testTypes = {
  cache: 1,
  noCache: 2,     // todo
  redirect: 3,    // todo
  pathRewrite: 4  // todo
}
Object.freeze(testTypes);

// presumably we will get these from consul / provisioning
// we will also need some validation!!
const tests = [
  {
    name:   "whole-site a-b test",
    type:   testTypes.noCache,
    start:  new Date('2021-01-01T00:00:00Z'), // default to UTC (Zulu) time, but can use other TZs
    end:    new Date('2022-01-01T00:00:00Z'),
    path:   "/",
    cookie: "site-a-b",
    header: "x-site-a-b",
    split: [
      {
        label: "A",
        percentage: 50
      },
      {
        label: "B",
        percentage: 50
      },
    ]
  }
]

function assignTestGroup(test) {
  let inc = 0;
  let group;
  const random = Math.random() * 100;
  for (const item of test.split) {
    inc += item.percentage
    if (random < inc) {
      group = item.label;
      break;
    }
  }
  return group;
}

function getModifiedRequest(request) {
  const myUrl = new URL('https://grantoz.github.io')
  const modifiedRequest = new Request(myUrl, {
    method: request.method,
    headers: request.headers
  })
  return modifiedRequest;
}

async function fetchAndApply(request) {

  const url = new URL(request.url);

  console.log(request.url)
  console.log('pathname', url.pathname)

  // do not run for customerState requests
  if(url.pathname.includes('ajaxcalls/customerState')) {
    console.log('got customerState path match')
    //return fetch(request)
    return fetch(getModifiedRequest(request))
  }

  // do not run for static assets (TODO: \.html? bypass)
  if(url.pathname.match(/\.\w{2,4}$/)) {
    console.log('got static asset match')
    //return fetch(request)
    return fetch(getModifiedRequest(request))
  }

  // do not run for asset paths
  if (url.pathname.match(/^\/(media|skin|minify)/)) {
    // unset query path
    // unset cookie header
    // set header: X-Varnish-Strip-Cookie: 1/

    console.log('got media path match')
    //return fetch(request)
    return fetch(getModifiedRequest(request))
  }

  // TODO ?search parameter whitelisting and stripping

  // just for now, obviously - we will want to iterate on the array of tests
  const test = tests[0];

  // 1. Determine which test group this request is in (TODO: refactor)
  let group          // which group is the user in / does get assigned to
  let isNew = false  // is the test group newly-assigned?

  const cookie = request.headers.get('Cookie')
  const re = new RegExp(`${test.cookie}=(${test.split.map(item => item.label).join('|')});`)
  let found

  if (cookie && (found = cookie.match(re))) {
    group = found[1] // user is in this group (test.split[n].label) e.g. "A"
  } else {
    // assign user to a group based on test split
    group = assignTestGroup(test)
    isNew = true
  }

  // 2. at this point we should look things up in the cache (TODO: refactor)

  // for now we'll assume that we always add the test x-header to the outbound request
  // so that the backend can create a new 
  const backendRequestHeaders = new Headers(request.headers)
  backendRequestHeaders.append(test.header, group)

  // here we have top-level directories named "control" and "test" for a redirect-type test
  // let url = new URL(request.url)
  // url.pathname = `/${group}${url.pathname}`

  const myUrl = new URL('https://grantoz.github.io')

  const modifiedRequest = new Request(myUrl, {
    method: request.method,
    headers: backendRequestHeaders
  })

  const response = await fetch(modifiedRequest)

  if (isNew) {
    // The experiment was newly-assigned, so add a Set-Cookie header to the response.
    const newHeaders = new Headers(response.headers)
    newHeaders.append('Set-Cookie', `${test.cookie}=${group}`)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    })
  } else {
    // Return response unmodified.
    return response
  }
}
