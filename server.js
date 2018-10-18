const fs = require('fs');
const express = require('express');
const path = require('path');
const asciidoctor = require('asciidoctor.js');
const adoc = asciidoctor();

const app = express();
const port = process.env.PORT || 5001;

const walkthroughs = [];

fs.readdir('./public/walkthroughs', (err, files) => {
  files.forEach((dirName) => {
    fs.readFile(`./public/walkthroughs/${dirName}/walkthrough.adoc`, (err, rawAdoc) => {
      if(err) {
        console.error(err);
        process.exit(1);
      }
      const loadedAdoc = adoc.load(rawAdoc);
      walkthroughs.push(getWalkthroughInfoFromAdoc(dirName, loadedAdoc));
    });
  });
});

function getWalkthroughInfoFromAdoc(dirName, adoc) {
  
  // Retrieve the short description. There must be a gap between the document title and the short description.
  // Otherwise it's counted as the author field. For example, see this adoc file:
  // ````
  // = This is a title
  // This is an author field
  // This would be the revision field or something
  // This is the short description.
  // ````
  // So it's better to just tell the user to put a blank line between the title and short description. 
  let shortDescription = '';
  if (adoc.blocks[0] && adoc.blocks[0].context === 'preamble' && adoc.blocks[0].blocks.length > 0) {
    shortDescription = adoc.blocks[0].blocks[0].lines[0];
  }

  return {
    id: dirName,
    title: adoc.getDocumentTitle(),
    shortDescription: shortDescription,
    // description: getPreambleBlockContent(adoc),
    time: adoc.getAttribute('time'),
    adoc: `/public/walkthroughs/${dirName}/walkthroughs.adoc`
  }
}


app.get('/customWalkthroughs', (req, res) => {
  res.status(200).json(walkthroughs);
});

// Dynamic configuration for openshift API calls
app.get('/config.js', (req, res) => {
  if (!process.env.OPENSHIFT_HOST) {
    console.warn('OPENSHIFT_HOST not set. Using service URLs from env vars');
    res.send(`window.OPENSHIFT_CONFIG = {
      masterUri: 'mock-openshift-console-url',
      mockData: {
        serviceInstances: [
          {
            spec: {
              clusterServiceClassExternalName: 'enmasse-standard'
            },
            status: {
              dashboardURL:'${process.env.OPENSHIFT_URL}',
              conditions: [{ status: 'True' }]
            }
          },
          {
            spec: {
              clusterServiceClassExternalName: '3scale'
            },
            status: {
              dashboardURL:'${process.env.OPENSHIFT_URL}',
              conditions: [{ status: 'True' }]
            }
          },
          {
            spec: {
              clusterServiceClassExternalName: 'amq-broker-71-persistence'
            },
            status: {
              dashboardURL:'${process.env.OPENSHIFT_URL}',
              conditions: [{ status: 'True' }]
            }
          },
          {
            spec: {
              clusterServiceClassExternalName: 'fuse'
            },
            status: {
              dashboardURL:'${process.env.OPENSHIFT_URL}',
              conditions: [{ status: 'True' }]
            }
          },
          {
            spec: {
              clusterServiceClassExternalName: 'launcher'
            },
            status: {
              dashboardURL:'${process.env.OPENSHIFT_URL}',
              conditions: [{ status: 'True' }]
            }
          },
          {
            spec: {
              clusterServiceClassExternalName: 'che'
            },
            status: {
              dashboardURL:'${process.env.OPENSHIFT_URL}',
              conditions: [{ status: 'True' }]
            }
          }
        ]
      }
    };`);
  } else {
    let redirectHost = null;
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']) {
      redirectHost = `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`;
    } else {
      redirectHost = `https://${req.headers.host}`;
    }
    let logoutRedirectUri = null;
    if (process.env.NODE_ENV === 'production') {
      logoutRedirectUri = redirectHost;
    } else {
      logoutRedirectUri = 'http://localhost:3006';
    }

    res.send(`window.OPENSHIFT_CONFIG = {
      clientId: '${process.env.OPENSHIFT_OAUTHCLIENT_ID}',
      accessTokenUri: 'https://${process.env.OPENSHIFT_HOST}/oauth/token',
      authorizationUri: 'https://${process.env.OPENSHIFT_HOST}/oauth/authorize',
      redirectUri: '${redirectHost}/oauth/callback',
      scopes: ['user:full'],
      masterUri: 'https://${process.env.OPENSHIFT_HOST}',
      wssMasterUri: 'wss://${process.env.OPENSHIFT_HOST}',
      ssoLogoutUri: 'https://${process.env.SSO_ROUTE}/auth/realms/openshift/protocol/openid-connect/logout?redirect_uri=${logoutRedirectUri}'
    };`);
  }
});

if (process.env.NODE_ENV === 'production') {
  // Serve any static files
  app.use(express.static(path.join(__dirname, 'build')));
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

app.listen(port, () => console.log(`Listening on port ${port}`));
