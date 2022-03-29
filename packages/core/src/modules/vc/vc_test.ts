import jsonld from 'jsonld'

const doc = {
  '@context': 'http://schema.org/',
  '@type': 'Person',
  name: 'Jane Doe',
  jobTitle: 'Professor',
  telephone: '(425) 123-4567',
  url: 'http://www.janedoe.com',
}

const run = async () => {
  console.log(await jsonld.expand(doc))
}

run()
