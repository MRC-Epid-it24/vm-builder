# Intake24 VM Builder v1

## Prerequisites

- Anisble.
- VirtualBox (tested with v6.1).
- Built versions of the api-v1 and api-v2, data-export-service, and survey-front-end.
- This will run on any system that supports Ansible and VirtualBox.
- You will need approximately 8GB of disk space.

## Description

This script downloads the base VM image for Intake24, and initialises the food and system databases.

## Installation

1. Build API v1, dataExportService
2. Download API v2
3. Build Survey Frontend
4. VM-Builder

### 1. Building the API v1 and dataExportService

Install OpenJDK
`sudo apt-get install openjdk-8-jdk-headless`

Clone the deployment repository:
`git clone https://github.com/MRC-Epid-it24/deployment.git`

From the deployment repository, install the Scala Build Tools (sbt):
`sudo ./build-deps/install-sbt.sh`

Install Gradle **(take instructions from the README)**

(Most likely download the bin-only, extract to /opt/gradle, add to PATH variable)

Clone API v1
`git clone --recurse-submodules -j8 https://github.com/intake24/api-server`

Build API v1 and Data Export service
`sbt "apiPlayServer/debian:packageBin" "dataExportService/debian:packageBin"`

Generate playSecret. Keep this handy as you will need it in section 4.
`sbt apiPlayServer/playGenerateSecret`

### 2. Download API v2

**Please contact the research team to receive a download link for the .jar file**

### 3. Build Survey Frontend

Survey frontend relies on Maven to build:
`sudo apt-get install maven npm`

Clone survery-frontend
`git clone --recurse-submodules https://github.com/MRC-Epid-it24/survey-frontend.git`

`mvn clean install -DskipTests`

Once built, build the Intake24 survey feedback module:
`cd intake24feedback cp ./src/animate-ts/animate-base.config.ts ./src/animate-ts/animate.config.ts npm install npm run buildForPlay`

Build the Intake24 survey server:
`cd SurveyServer sbt debian:packageBin`

### 4. VM Builder

This is a node/npm project and in order to run it you will need to do the following in the repository directory:
`npm install`
`tsc`

Copy config.example.js into `build` folder

You will need to input the following locations:

- API v1 .deb file: [e.g. path] `ApiPlayServer/target/intake24-api-server_3.30.2-SNAPSHOT_all.deb`
- DataExportService .deb file: [e.g. path] `DataExportService/target/intake24-data-export_4.2.0-SNAPSHOT_all.deb`
- API v1 generated API play secret
- API v2 .jar file: [e.g. path] `api-v2/APIServer/build/libs/intake24-api-v2-(version)-all.jar`
- Survey Frontend .deb file: [e.g. path] `/SurveyServer/target/intake24-survey-site_(version)_all.deb`

Before you begin, configure the host network adapter in VirtualBox:

- File > Host Network Manager
- Click 'Create', then 'Properties'
- 'Configure Adapter Manually' with the following (if not already default):
  - IPv4 Address: 192.168.57.1
  - IPv4 Network Mask: 255.255.255.0

From the root vm-builder folder, run:
`cd build`
`node main.js`

Type `node main.js --help` to see available options.

This will download 4 large files, and may take some time. Once this is done it will initialise VirtualBox and import the VM

You may need to close the VirtualBox main window (not the VM) to allow the vm-builder script to continue.

[Note] You may need to install support for USB 2 (or disable USB 2 support), and increase the Video Memory if you receive errors.
