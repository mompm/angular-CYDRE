
![](./frontEnd/front/src/assets/img/Logo_Cydre_Partenaires.jpg#center "Application logo")

# 1. Introduction

This application is intended for the seasonal streamflow forecasting of rivers within watersheds located in crystalline geological contexts.

# 2. Installation

Clone the repo:

```
git clone https://gitlab.com/mompm1/cydre-angular.git
```

Go to the application folder:

```
cd cydre-angular
```


## 2.1. front-end Angular

**Requirements :**
- Nodejs (https://nodejs.org/en)

Install Angular :

```
npm install -g @angular/cli
npm install primeng
``` 

You can check the installation with :

```
npm -v
node -v
ng v
``` 

Install the project packages and run the front server :

```
cd frontEnd/front
npm install
ng serve
```

Go to http://localhost:4200/ on a web Browser to see the result.
You'll need to run api2.py (see the following section about python installation)

## 2.2. back-end Python

**Requirements :**
- Miniconda (https://repo.anaconda.com/miniconda/).
- MySQL (https://dev.mysql.com/downloads/installer/)

Create conda environment, install python requirements and activate the environment: 

```
cd backEnd/install
conda env create -f cydre.yml
conda activate cydre
```

Create the environment variable:

```
python set_cydre_environment_variable.py
```

Create the MySQL database, the associated tables and default/admin users :

```
python create_database.py
```

Run the back-end server with api2.py : 

```
python api2.py
```

For a standalone version :
Go to the launcher folder and run application 

```
cd backEnd/launchers
python run_cydre.py
```