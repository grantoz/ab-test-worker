import { tests } from './tests.js'

// Serve different variants of your site to different visitors
addEventListener('fetch', event => {
  event.respondWith(fetchAndApply(event.request))
})

// presumably we will get these from consul / provisioning
// we will also need some validation!!

// just while we are testing this with ab.made-test.com
const defaultBackend = 'https://made-test.com'
const useDefaultBackend = true

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

function getRequest(request, headers) {

  if (typeof headers !== 'undefined' && false === useDefaultBackend) {
    return request
  }

  // use updated headers if they have been passed, otherwise default to original request headers
  const newHeaders = (typeof headers !== 'undefined') ? headers : request.headers

  // use the defaultBackend (made-test.com, above) while this is still a POC
  const url = new URL((useDefaultBackend) ? defaultBackend : request.url)

  // dev: use the header iterator to show what we'll be sending
  for (let value of newHeaders.entries()) {
    console.log(value);
  }

  const newRequest = new Request(url, {
    method: request.method,
    headers: newHeaders
  })

  return newRequest;
}

async function fetchAndApply(request) {

  // convenience for URL parsing
  const url = new URL(request.url);

  // do not run for customerState requests
  if(url.pathname.includes('ajaxcalls/customerState')) {
    console.log('got customerState path match')
    return fetch(getRequest(request))
  }

  // do not run for static assets (TODO: \.html? bypass)
  if(url.pathname.match(/\.\w{2,4}$/)) {
    console.log('got static asset match')
    return fetch(getRequest(request))
  }

  // do not run for asset paths
  if (url.pathname.match(/^\/(media|skin|minify)/)) {
    // TODO: unset query path
    // TODO: unset cookie header
    // TODO: set header: X-Varnish-Strip-Cookie: 1/
    console.log('got media path match')
    return fetch(getRequest(request))
  }

  // TODO: ?search parameter whitelisting and stripping

  // TODO: iterate over tests, check path and date validity before running
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

  // 2. at this point we should look things up in the cache

  // for now we'll add the test x-header to the outbound request, so that the backend can ID it
  const backendRequestHeaders = new Headers(request.headers)
  backendRequestHeaders.append(test.header, group)

  // here we have top-level directories named "control" and "test" for a redirect-type test
  // let url = new URL(request.url)
  // url.pathname = `/${group}${url.pathname}`

  const upstreamRequest = getRequest(request, backendRequestHeaders)
  const response = await fetch(upstreamRequest)

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
