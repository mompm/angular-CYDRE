# -*- coding: utf-8 -*-
"""
Created on Wed Oct 25 19:39:10 2023

@author: Nicolas Cornette
"""

# Python modules
import os

# Import the Cydre modules
import utils.toolbox as toolbox
import libraries.forecast.cydre as CY
import libraries.preprocessing.historical_data as HI
import tools.Parameters.Parameters.ParametersGroup as pg


class Initialization():
    
    
    def __init__(self, app_root, stations):
        
        self.app_root = app_root
        self.data_path = os.path.join(self.app_root, 'data')
        self.stations = stations
        self.version = None
        self.output_path = None
        self.params = None
        self.watersheds = None
    
    
    def cydre_initialization(self):
        
        # Define the path for loading data within the specified directory.
        self.output_path = self.prepare_data_path(self.app_root)

        # Retrieve XML parameters for the forecast.
        self.params = self.load_xml_parameters()

        # Load and process watershed data
        #self.watersheds = self.load_and_process_watershed_data()

        # Create an instance of CydreForecastApp with the prepared watershed data and forecast parameters.
        cydre_app = self.create_cydre_app()
        
        return cydre_app
    
    
    def prepare_data_path(self, app_root):
        output_path = os.path.join(app_root, "outputs")
        toolbox.create_folder(output_path)
        
        return output_path
    
    
    def load_xml_parameters(self):
        
        # local folder of example
        #folder = os.path.dirname(os.path.abspath(__file__))
        folder = os.path.join(self.app_root, "launchers")
        
        # Initialization of Reference ParametersGroup
        file_ref = os.path.join(folder,"run_cydre_params.xml")
        
        # ref = pg.ParametersGroup(file_ref)   
        # Loads User ParametersGroup
        file_usr = os.path.join(folder,"run_cydre_params.xml")  
        
        # Results folder: defines and creates
        #JR-ATTENTION: folder_res à transmettre pour les résultats
        #vec=folder.split('\\')
        #folder_res = os.path.join(os.getenv("CYDRE").replace('/',os.sep),vec[-2],vec[-1])
        folder_res = folder
        os.makedirs(folder_res,exist_ok=True)
        
        # Merges the two structures and affects default_values to values when necessary
        paramgroup = pg.ParametersGroup.merge_diff(file_ref,file_usr,pg.EXPLOPT.REPLACE,folder_res)[0]
        
        return paramgroup
    
    
    def load_and_process_watershed_data(self):
        # Il faudrait peut-être revoir cette partie pour que l'actualisation quotidienne des séries temporelles se fasse ici
        # Peut-être revoir aussi le format des données (ici objet python/dictionnaire d'instances, est-ce la meilleure solution ?)
        datasets_filename = self.params.getgroup('General').getparam('datasets').getvalue()
        HistoricalData = HI.HistoricalData(path=self.output_path, filename=datasets_filename)
        watersheds = HistoricalData.data
       # watershed_bugs = ['J2514010', 'J2614010', 'J3024010', 'J3204020', 'J3323020','J3403010', 'J3631810',
        #                  'J3733010', 'J4313010', 'J4712010', 'J4742010',
         #                 'J7833010', 'J8202310', 'J8433010']
        #watersheds = HistoricalData.remove_watersheds(data=watersheds, watershed_id=watershed_bugs)
        
        return watersheds
    
    
    def create_cydre_app(self):
        
        self.version = self.params.getgroup('General').getparam('version').getvalue()

        if self.version == 'application':
            # In prep...
            # Update timeseries datasets 
            #self.watersheds...
            print('--- Update database ----')

        return CY.Cydre(self.stations, self.data_path, self.params, self.version)


    def get_parameters_path(self, param_names):
        param_paths = []

        for param_name in param_names:
            param_path = []

            # Split the param_name by dots to handle nested parameters
            param_parts = param_name.split('.')
            search_path = './/'

            # Build the search path to handle nested parameters
            for part in param_parts:
                search_path += f'*[@name="{part}"]/'
            search_path = search_path.rstrip('/')

            # Search for the parameter in the XML tree
            param_element = self.params.root.find(search_path)

            if param_element is not None:
                # Search for the path to the parameter by traversing up the tree
                current_element = param_element
                while current_element is not None:
                    if current_element.tag == 'ParametersGroup':
                        param_path.insert(0, current_element.get('name'))
                    current_element = current_element.getparent()

                # Add the full param_name to the end of the path
                param_path.append(param_parts[-1])

            param_paths.append(param_path)

        return param_paths
