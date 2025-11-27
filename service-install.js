var Service = require('node-windows').Service;
var path = require('path');

// Create a new service object
var svc = new Service({
  name: 'Gemini Diary Service',
  description: 'Node.js Server for Gemini Diary application (Frontend + Backend)',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
        name: "PORT",
        value: 8000
    },
    {
        // If you have API keys as system env vars, they are usually inherited, 
        // but you can explicitly define them here if needed for the service context.
        name: "API_KEY", 
        value: process.env.API_KEY || "" 
    }
  ]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function(){
  console.log('Gemini Diary Service installed successfully.');
  svc.start();
});

svc.on('alreadyinstalled', function(){
    console.log('Service is already installed.');
    svc.start();
});

// Install the script
svc.install();
