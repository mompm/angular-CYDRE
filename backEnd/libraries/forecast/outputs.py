# -*- coding: utf-8 -*-
"""
Created on Thu Jun 22 14:50:29 2023

@author: Nicolas Cornette
"""

# Python modules
import os
import pickle
import numpy as np
import json
import matplotlib as mpl 
import matplotlib.dates as mdates
from matplotlib.dates import DateFormatter
import matplotlib.pyplot as plt
import pandas as pd
import geopandas as gpd
import plotly.express as px
import plotly.offline as pyo
import plotly.graph_objects as go
from shapely.geometry import MultiPolygon, Polygon
from scipy.signal import find_peaks
from scipy.interpolate import interp1d

# Cydre modules
import libraries.forecast.evaluation as EV


class Outputs():
    
    """
    Class used to manage cydre results and do some plots.
    """
    
    def __init__(self, cydre_app, output_path, watershed_name, stations, selected_date,
                 log=True, module=False, baseflow=False, options='viz_matplotlib'):
        
        # Cydre simulation outputs
        self.version = cydre_app.version
        self.output_path = output_path
        self.stations = stations
        self.watershed_name = watershed_name
        self.watershed_id = cydre_app.UserConfiguration.user_watershed_id
        self.watershed_area = cydre_app.watersheds[self.watershed_id]['hydrometry']['area']
        self.streamflow = cydre_app.watersheds[self.watershed_id]['hydrometry']['specific_discharge']
        self.precipitation = cydre_app.watersheds[self.watershed_id]['climatic']['precipitation']
        self.selected_date = selected_date
        self.simulation_date = cydre_app.date
        self.similarity_period = cydre_app.Similarity.user_similarity_period
        self.clusters = cydre_app.Similarity.clusters
        self.watershed_similarity = cydre_app.Similarity.watershed_similarity
        self.similar_watersheds = cydre_app.Similarity.similar_watersheds
        self.correlation_matrix = cydre_app.scenarios
        self.scenarios = cydre_app.scenarios_grouped
        self.scenarios_chronicles = cydre_app.Forecast.scenarios_with_chronicles
        self.projection_period = cydre_app.Forecast.forecast_period
        self.streamflow_proj = cydre_app.df_streamflow_forecast
        self.streamflow_proj_series = cydre_app.Forecast.Q_streamflow_forecast_normalized
        self.streamflow_proj_series_raw = cydre_app.Forecast.Q_streamflow_forecast
        self.storage_proj = cydre_app.df_storage_forecast
        self.station_forecast = cydre_app.df_station_forecast
        
        # Evaluation version
        if self.version == 'test':
            self.user_streamflow_forecast = cydre_app.UserConfiguration.user_streamflow[cydre_app.UserConfiguration.user_streamflow.index.isin(self.projection_period)]
            self.user_recharge_forecast = cydre_app.UserConfiguration.user_recharge[cydre_app.UserConfiguration.user_recharge.index.isin(self.projection_period)]
            self.user_runoff_forecast = cydre_app.UserConfiguration.user_runoff[cydre_app.UserConfiguration.user_runoff.index.isin(self.projection_period)]
            self.user_storage_forecast = cydre_app.UserConfiguration.user_storage[cydre_app.UserConfiguration.user_storage.index.isin(self.projection_period)]
            self.streamflow_projection_period = self.user_streamflow_forecast
            self.storage_projection_period = self.user_storage_forecast

        # Store results
        self.manage_outputs_path()
        self.save_correlation_matrix()
        self.save_watershed_similarity()
        
        # Plot results
        self.streamflow_fig = self.plot_streamflow_projections(log, module, baseflow, options)
        self.streamflow_volume()
        self.storage_variations()
        self.baseflow()
        
#        if self.version == 'test':
 #           self.plot_streamflow_volume()
  #          self.plot_storage_variations()
    
    
    def manage_outputs_path(self):
        
        # Watershed folder for storing outputs as plots
        self.watershed_path = os.path.join(self.output_path, self.watershed_name)
        self.simulation_path = os.path.join(self.watershed_path, self.selected_date.strftime('%Y-%m-%d'))
        if not os.path.exists(self.watershed_path):
            os.makedirs(self.watershed_path)
        if not os.path.exists(self.simulation_path):
            os.makedirs(self.simulation_path)
            
    
    def save_correlation_matrix(self):
        
        filename = os.path.join(self.simulation_path, 'corr_matrix.txt')
        self.correlation_matrix.to_csv(filename)
    
    
    def save_watershed_similarity(self):
        
        filename = os.path.join(self.output_path, self.watershed_name, 'watershed_similarity.txt')
        df = self._filter_watershed_similarity()
        df.to_csv(filename)
        
    
    def save_performance(self, model_quality):
        
        filename = os.path.join(self.simulation_path, 'model_quality.pkl')
        
        with open(filename, 'wb+') as f:
            pickle.dump(model_quality, f, pickle.HIGHEST_PROTOCOL)
        
        #with open(filename, 'w') as file:
            #json.dump(model_quality, file)
        
    
    def plot_streamflow_projections(self, log=True, module=False, baseflow=False, options='viz_matplotlib'):
        
        # -------------- FOLDER --------------
        
        # Watershed folder for storing outputs as plots
        if log:
            filename = os.path.join(self.watershed_path, f"log_{str(self.simulation_date.date())}.tiff")
        else:
            filename = os.path.join(self.watershed_path, f"lin_{str(self.simulation_date.date())}.tiff")
        
        # -------------- CYDRE RESULTS --------------

        # Extract observation and projection timeseries data
        reference_df, projection_df, projection_series = self._get_streamflow()
        
        # Adding stations projections
        self.station_forecast.index = projection_df.index
        projection_df['Q50_station'] = self.station_forecast['Q50']
        projection_df['Q50_station'] *= (self.watershed_area * 1e6)
        projection_df['Q10_station'] = self.station_forecast['Q10']
        projection_df['Q10_station'] *= (self.watershed_area * 1e6)
        projection_df['Q90_station'] = self.station_forecast['Q90']
        projection_df['Q90_station'] *= (self.watershed_area * 1e6)
        
        # -------------- OPERATIONAL INDICATORS --------------
        
        # Calculate the module (1/10 x mean streamflow)
        if module:
            self.mod, self.mod10 = self._module(reference_df)
        
        # Projected streamflow (last day value and evolution)
        self.proj_values = projection_df.iloc[-1]
        self.proj_values_ev = (self.proj_values - reference_df['Q'][-1])/reference_df['Q'][-1] * 100
        
        # Number of days before projected streamflow intersect the module
        mod10_intersect = projection_df[['Q10', 'Q50', 'Q90']] <= self.mod10
        mod10_alert = mod10_intersect & mod10_intersect.shift(-1)
        
        try:
            mod10_first_occurence_Q10 = projection_df[mod10_alert['Q10']].iloc[0].name 
            self.ndays_before_alert_Q10 = (mod10_first_occurence_Q10 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q10 = None
            self.ndays_before_alert_Q10 = 0
        
        try:
            mod10_first_occurence_Q50 = projection_df[mod10_alert['Q50']].iloc[0].name 
            self.ndays_before_alert_Q50 = (mod10_first_occurence_Q50 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q50 = None
            self.ndays_before_alert_Q50 = 0
            
        try:
            mod10_first_occurence_Q90 = projection_df[mod10_alert['Q90']].iloc[0].name
            self.ndays_before_alert_Q90 = (mod10_first_occurence_Q90 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q90 = None
            self.ndays_before_alert_Q90 = 0
        
        # Number of cumulated days below the alert threshold
        self.ndays_below_alert = np.sum(mod10_intersect)
        
        # Proportion of past events below the alert threshold
        n_events = len(projection_series)
        n_events_alert = 0
        
        for events in range(len(projection_series)):
            projection_series[events]['intersection'] = projection_series[events]['Q_streamflow'] <= self.mod10
            projection_series[events]['alert'] = projection_series[events]['intersection'] & projection_series[events]['intersection'].shift(-1)
            if projection_series[events]['alert'].any():
                n_events_alert += 1
            else:
                n_events_alert += 0
        
        self.prop_alert_all_series = n_events_alert / n_events
        
        # Volume to supply low flows
        alert_df = projection_df[mod10_alert['Q10']]
        q_values = alert_df['Q10'] * 86400
        self.volume10 = ((self.mod10*86400) - q_values).sum()
        
        alert_df = projection_df[mod10_alert['Q50']]
        q_values = alert_df['Q50'] * 86400
        self.volume50 = ((self.mod10*86400) - q_values).sum()
        
        alert_df = projection_df[mod10_alert['Q90']]
        q_values = alert_df['Q90'] * 86400
        self.volume90 = ((self.mod10*86400) - q_values).sum()
        
        
      
        # Calculate baseflow
        if baseflow:
            self.Q_baseflow = self.baseflow()
            reference_df['baseflow'] = self.Q_baseflow * self.watershed_area * 1e6
        
       
            

            
        # Merge observation and projection timeseries data
        merged_df = pd.merge(reference_df, projection_df, left_on=reference_df.index,
                             right_on=projection_df.index, how='right')
        merged_df = merged_df.set_index(merged_df['key_0'])

        if options == 'viz_matplotlib':
               
            # Plot initialization
            plt.style.use('seaborn-dark-palette')
            plt.rcParams.update({'font.family':'Arial'})
            mpl.rcParams['figure.figsize'] = 7, 4

            fig, ax = plt.subplots()
            
            # Add the uncertainty area of streamflow projetions (between Q10 and Q90)
            ax.fill_between(merged_df.index, merged_df['Q10'], merged_df['Q90'], color='#407fbd',
                            alpha=0.10, edgecolor='#407fbd', linewidth=0, label="zone d'incertitude [projection]")
            ax.plot(merged_df.index, merged_df['Q10'], color='#407fbd', linewidth=0.3)        
            ax.plot(merged_df.index, merged_df['Q90'], color='#407fbd', linewidth=0.3)
            
            # Add the individual series used for the projections trends
            for i, line in enumerate(projection_series):
                ax.plot(line.index, line['Q_streamflow'], color='grey', linewidth=0.10, linestyle='--')
                
            # Add the Median projection
            ax.plot(merged_df.index, merged_df['Q50'], color='blue', linewidth=1.5, linestyle='dotted',
                label='projection médiane')
            
            # Add the uncertainty area of station projetions (between Q10 and Q90)
            #ax.fill_between(merged_df.index, merged_df['Q10_station'], merged_df['Q90_station'], color='purple',
            #                alpha=0.10, edgecolor='purple', linewidth=0, label="zone d'incertitude [station]")
            #ax.plot(merged_df.index, merged_df['Q10_station'], color='purple', linewidth=0.3)        
            #ax.plot(merged_df.index, merged_df['Q90_station'], color='purple', linewidth=0.3)
            
            # Add the staiton forecast
            #ax.plot(merged_df.index, merged_df['Q50_station'], color='purple', linewidth=1.5, linestyle='dotted',
             #       label='stats sur la station')
            
            # Add the real data measured at the hydrological station
            ax.plot(reference_df.index, reference_df['Q'], color='k', linewidth=1,
                label="observation")
            
            # Add a vertical line representing the simualtion date
            ax.axvline(x=self.simulation_date, color='k', linestyle='--', linewidth=0.8)
            
            # Add module if selected by the user
            if module:
                ax.axhline(y=self.mod10, color='r', linestyle='--', linewidth=0.6, label='1/10 du module')
            
            # Add baseflow if selected by the user
            if baseflow:
                ax.plot(merged_df.index, merged_df['baseflow'], color='green', linewidth=1, linestyle='--', label='baseflow')
                #ax.plot(merged_df.index, merged_df['baseflow2'], color='purple', linewidth=1, linestyle='--', label='baseflow2')
            
            #ax2 = ax.twinx()
            #ax2.plot(self.precipitation.index, self.precipitation['Q'], color='red', linewidth=0.8, label='Précipitations journalières')
            #ax2.invert_yaxis()

            
            # Set axis parameters
            ax.tick_params(axis="both", direction = "inout")
            ax.tick_params(axis='x', rotation=45)
            if log:
                ax.set_yscale('log')
            ax.set_xlim(self.similarity_period[0], self.projection_period[-1])
            ax.set_ylim(bottom=0.001)
            ax.set_xlabel("Date", fontsize=12)
            ax.set_ylabel("Débit (m3/s)", fontsize=12)
            ax.legend(ncol=4, fontsize=8)
            ax.set_title(f"{self.watershed_name}" + f" - {len(self.scenarios)} événements ", fontsize=14)
            
            #ax2.set_ylabel('Pluies journalières (mm)', fontsize=12)
            #ax2.tick_params(axis='y', labelcolor='red')
            #ax2.set_xlim(self.similarity_period[0], self.projection_period[-1])
            #ax2.set_ylim(0, 100)

            
            plt.savefig(filename, dpi=500, format="tiff", pil_kwargs={"compression": "tiff_lzw"}, bbox_inches='tight', pad_inches=0.1)
            plt.show()

            return fig
        
        elif options == 'viz_plotly':
            
            # Watershed folder for storing outputs as plots
            if log:
                filename = os.path.join(self.watershed_path, f"log_{str(self.simulation_date.date())}.html")
            else:
                filename = os.path.join(self.watershed_path, f"lin_{str(self.simulation_date.date())}.html")
            
            # Projection events
            scenarios, n_scenarios = self._get_projection_origin(self.scenarios_chronicles)
            
            # Plot initialization
            plt.style.use('seaborn-dark-palette')
            plt.rcParams.update({'font.family':'Arial'})
            #mpl.rcParams['figure.figsize'] = 7, 4

            fig = go.Figure()

            # Add the uncertainty area of streamflow projections (between Q10 and Q90)
            fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['Q90'], fill=None, mode='lines', 
                                    line=dict(color='#407fbd', width=1), fillcolor='rgba(64, 127, 189, 0.3)', showlegend=False,
                                    hoverinfo='skip'))
            fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['Q10'], fill='tonexty', mode='lines', 
                                    line=dict(color='#407fbd', width=1), fillcolor='rgba(64, 127, 189, 0.3)', name="zone d'incertitude",
                                    hoverinfo='skip'))

            # Add the individual series used for the projections trends
            for i, line in enumerate(projection_series):
                fig.add_trace(go.Scatter(x=line.index, y=line['Q_streamflow'], mode='lines', 
                                        line=dict(color='grey', width=0.2, dash='dash'),
                                        hoverinfo='skip', showlegend=False))

            # Add the Median projection
            fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['Q50'], mode='lines', 
                                    line=dict(color='blue', width=1.5, dash='dot'), name='projection médiane'))

            # Add the real data measured at the hydrological station
            fig.add_trace(go.Scatter(x=reference_df.index, y=reference_df['Q'], mode='lines', 
                                    line=dict(color='black', width=1.5), name="observation"))

            # Add a vertical line representing the simulation date
            max_value = np.nanmax([merged_df['Q'].max(), projection_df['Q90'].max(), reference_df.loc[self.similarity_period]['Q'].max()])
            fig.add_shape(type="line", x0=self.simulation_date, y0=0, x1=self.simulation_date, y1=1, yref='paper', 
                        line=dict(color="rgba(0, 0, 0, 1)", width=1, dash="dot"))
            
            fig.add_annotation(
                x=self.simulation_date,  # Position x de l'annotation
                y=1.1,  # Position y de l'annotation (au-dessus de la ligne)
                text="Début de la simulation",  # Texte de l'annotation
                showarrow=True,  # Masquer la flèche
                font=dict(
                    family="Arial",
                    size=12,
                    color="black"
                ),
                align="center"  # Alignement du texte
            )
            
            fig.add_layout_image(
                dict(
                    source="https://upload.wikimedia.org/wikipedia/fr/e/eb/Logo_Centre_national_de_la_recherche_scientifique_%282008-2023%29.svg", # Chemin ou URL de l'image
                    xref="paper", yref="paper",
                    x=1, y=1.05,
                    sizex=0.2, sizey=0.2,
                    xanchor="right", yanchor="bottom"
                    )
             )

            # Add module if selected by the user
            if module:
                fig.add_trace(go.Scatter(
                    x=[merged_df.index.min(), merged_df.index.max()],
                    y=[self.mod10, self.mod10],
                    mode='lines',
                    line=dict(color="red", width=1),
                    name='1/10 du module'
                ))

            # Add baseflow if selected by the user
            if baseflow:
                fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['baseflow'], mode='lines', 
                                        line=dict(color='green', width=1, dash='dash'), name='baseflow'))
                #fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['baseflow2'], mode='lines', 
                #                         line=dict(color='purple', width=1, dash='dash'), name='baseflow2'))

            # Set axis parameters
            fig.update_xaxes(range=[self.similarity_period[0], self.projection_period[-1]], 
                 #tickvals=pd.date_range(start=self.similarity_period[0], end=self.projection_period[-1]),
                 tickformat="%d-%m-%Y", title="Date", showgrid=False, type='date')
            fig.update_yaxes(range=[1e-3, None], showgrid=False)


            #fig.update_xaxes(tickvals=pd.date_range(start=self.similarity_period[0], end=self.projection_period[-1], freq='Y'),
            #                tickformat="%Y", title="Date")
            fig.update_yaxes(type='log' if log else None, title="Débit (m3/s)", rangemode='tozero')
            fig.update_layout(title=f"{self.watershed_name}" + f" - {len(self.scenarios)} événements ", legend=dict(x=0, y=1.1, orientation="h"),
                            margin=dict(l=40, r=40, t=80, b=40), plot_bgcolor='white')
            
            fig.update_layout(template="simple_white")  # Choisir un modèle de thème, par exemple "plotly_dark"
            fig.update_layout(font=dict(family="Arial"))  # Définir la police de caractères
            fig.update_layout(width=800, height=450)  # Définir la largeur et la hauteur de la figure
            fig.update_layout(hovermode='x unified')  # Limite les informations affichées au survol à l'axe x uniquement
            fig.update_layout(hovermode='closest')  # Affiche les informations pour la trace la plus proche du point de survol
        
            # Save and show plot
            fig.write_html(filename)
            fig.show()

            return fig
     
    
    def _get_streamflow(self):
        
        # Observation
        reference_df = self.streamflow.copy()
        reference_df['daily'] = reference_df.index.strftime('%m-%d')
        reference_df['Q'] *= (self.watershed_area * 1e6) # m/s > m3/s
        
        # Projections
        projection_df = self.streamflow_proj.copy()
        projection_df = projection_df.set_index(self.projection_period)
        projection_df *= self.watershed_area * 1e6 # m/s > m3/s
        
        # Individual projections
        projection_series = []
        
        for serie in self.streamflow_proj_series:
            serie = pd.DataFrame(serie)
            serie['Q_streamflow'] *= (self.watershed_area * 1e6)
            serie = serie.set_index(self.projection_period)
            projection_series.append(serie)
        
        return reference_df, projection_df, projection_series
    
    
    def _module(self, reference_df):
        reference_df['year'] = reference_df.index.year
        df = reference_df.groupby('year')['Q'].mean()
        mod = df.mean()
        mod10 = mod/10
        return mod, mod10
    
    
    def streamflow_volume(self):
        """
        Cumulated volume calculation at the outlet between the simulation date and the last date of projetction
        using the area below the curve approach.

        Parameters
        ----------
        df : TYPE
            DESCRIPTION.

        Returns
        -------
        area_below : TYPE
            DESCRIPTION.

        """
        # Cumulated volume for projections series
        df_proj = self.streamflow_proj.copy() * self.watershed_area * 1e6
        self.volume_proj = pd.Series.cumsum(df_proj)
        self.volume_proj *= 86400
        
        # Cumulated volume for observation series
        if self.version == 'test':
            df_user = self.streamflow_projection_period.copy() * self.watershed_area * 1e6
            self.volume_user = pd.Series.cumsum(df_user)
            self.volume_user *= 86400
    
        # Compute total volume (storage variations with hydrological bilan)
        #self._storage = self.storage_variations(cydre_app, projection_df)
        # Time before intersection with alert threshold
        #projection_df['intersection'] = projection_df['Q50'] <= mod10
        #projection_df['alert'] = projection_df['intersection'] & projection_df['intersection'].shift(-1)
        #first_occurence = projection_df[projection_df['alert']].iloc[0]
        #date_first_occurence = first_occurence.name
        #ndays_before_alert = (date_first_occurence - projection_df.index[0]).days
        #print(f"Atteinte du seuil d'alerte dans {int(ndays_before_alert)} jours")
    
    
    def plot_streamflow_volume(self):
        
        filename = os.path.join(self.watershed_path, f"volume_{str(self.simulation_date.date())}.tiff")
        
        # Plot initialization
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        mpl.rcParams['figure.figsize'] = 5, 5
        
        fig, ax = plt.subplots()
        
        ax.fill_between(self.volume_user['Q'].index, self.volume_proj['Q10'], self.volume_proj['Q90'], color='#407fbd',
                        alpha=0.20, edgecolor='#407fbd', linewidth=0, label="zone d'incertitude")
        ax.plot(self.volume_user['Q'].index, self.volume_proj['Q10'], color='#407fbd', linewidth=0.3)        
        ax.plot(self.volume_user['Q'].index, self.volume_proj['Q90'], color='#407fbd', linewidth=0.3)
        
        # Add observation and projection storage variations lines
        ax.plot(self.volume_user['Q'].index, self.volume_user['Q'], color='black', label='observation')
        ax.plot(self.volume_user['Q'].index, self.volume_proj['Q50'], color='blue', linestyle='--', label='projection médiane')
        ax.plot(self.volume_user['Q'].index, self.volume_proj['Qmean'], color='blue', linestyle='-', linewidth=0.5, label='projection moyenne')
        
        # Set axis parameters
        ax.tick_params(axis="both", direction = "inout")
        ax.tick_params(axis="x", rotation=45)
        ax.set_ylim(bottom=0)
        ax.set_ylabel('Volume cumulé (m3)', fontsize=12)
        ax.set_title('Comparaison des volumes cumulés', fontsize=12)
        #ax.set_yscale('log')
        ax.legend(fontsize=8)
        
        plt.savefig(filename, dpi=500, format="tiff", pil_kwargs={"compression": "tiff_lzw"}, bbox_inches='tight', pad_inches=0.1)
        plt.show()
    
    
    def storage_variations(self):
        
        # Cumulated volume for projections series
        df_proj = self.storage_proj.copy() * self.watershed_area * 1e6
        self.storage_proj = pd.Series.cumsum(df_proj)
        self.storage_proj *= 86400
        
        # Cumulated volume for observation series
        if self.version == 'test':
            df_user = self.storage_projection_period.copy() * self.watershed_area * 1e6
            self.storage_user = pd.Series.cumsum(df_user)
            self.storage_user *= 86400
        
        
    def plot_storage_variations(self):
        
        filename = os.path.join(self.watershed_path, f"storage_{str(self.simulation_date.date())}.tiff")
        
        # Plot initialization
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        mpl.rcParams['figure.figsize'] = 5, 5
        
        fig, ax = plt.subplots()
        
        ax.fill_between(self.storage_user['Q'].index, self.storage_proj['Q10'], self.storage_proj['Q90'], color='#407fbd',
                        alpha=0.20, edgecolor='#407fbd', linewidth=0, label="zone d'incertitude")
        ax.plot(self.storage_user['Q'].index, self.storage_proj['Q10'], color='#407fbd', linewidth=0.3)        
        ax.plot(self.storage_user['Q'].index, self.storage_proj['Q90'], color='#407fbd', linewidth=0.3)
        
        # Add observation and projection storage variations lines
        ax.plot(self.storage_user['Q'].index, self.storage_user['Q'], color='black', label='observation')
        ax.plot(self.storage_user['Q'].index, self.storage_proj['Q50'], color='blue', linestyle='--', label='projection médiane')
        ax.plot(self.storage_user['Q'].index, self.storage_proj['Qmean'], color='blue', linestyle='-', linewidth=0.5, label='projection moyenne')
        
        # Set axis parameters
        ax.tick_params(axis="both", direction = "inout")
        ax.tick_params(axis="x", rotation=45)
        #ax.set_ylim(bottom=0)
        ax.set_ylabel('Stock cumulé (m3)', fontsize=12)
        ax.set_title('Comparaison des stocks cumulés', fontsize=12)
        #ax.set_yscale('log')
        ax.legend(fontsize=8)
        
        plt.savefig(filename, dpi=500, format="tiff", pil_kwargs={"compression": "tiff_lzw"}, bbox_inches='tight', pad_inches=0.1)
        plt.show()
               
    
    def baseflow(self):
        
        df = self.streamflow.copy() #* self.watershed_area * 1e6
        
        # Pas de temps (jours) pour les moyennes
        T_Wind = 10
        
        ### Valeur du turning point
        T_Point_val = 0.9
        
        # Calculer la valeur minimale tous les XX jours
        df['Date'] = pd.to_datetime(df.index, format='%d/%m/%Y')
        df.reset_index(drop=True, inplace=True)
        df['Min_XX_days'] = df['Q'].rolling(window=T_Wind, min_periods=1).min()
        
        # Trouver les minimums locaux dans les valeurs originales
        peaks, _ = find_peaks(-df['Q'], distance=5)
        
        # Créer une fonction d'interpolation basée sur les points de retournement
        interpolation_function = interp1d(df['Date'].apply(lambda x: x.timestamp()), df['Q'], kind='linear', fill_value="extrapolate")
        
        # Créer une nouvelle colonne pour les valeurs interpolées sur chaque date
        df['Interpolated_Values'] = interpolation_function(df['Date'].apply(lambda x: x.timestamp()))
        
        # Convertir la colonne 'Days_since_reference' en jours numériques
        df['Days_since_reference'] = (df['Date'] - df['Date'].min()).dt.days
        df['Days_since_reference'] = df['Days_since_reference'].astype('int')
        
        # Remplacer les valeurs manquantes par la différence de jours précédente
        df['Days_since_reference'] = df['Days_since_reference'].ffill()
        
        # Convertir la colonne 'Interpolated_Values' en float64
        df['Interpolated_Values'] = df['Interpolated_Values'].astype('float64')
        
        # Effectuer une interpolation entre les points de 5 jours
        interpolation_dates = df['Date']
        interpolation_values = np.interp(np.arange(len(interpolation_dates)), df.index, df['Min_XX_days'])
        
        # Ajouter une colonne pour les turning points
        df['Turning_Point'] = False
        
        # Identifier les turning points
        for i in range(1, len(df)-1):
            min_value = df['Min_XX_days'][i]
            prev_min = df['Min_XX_days'][i-1]
            next_min = df['Min_XX_days'][i+1]
        
            if T_Point_val * min_value < prev_min and T_Point_val * min_value < next_min:
                df.at[i, 'Turning_Point'] = True
        
        # Minima 
        test = df['Q'].iloc[peaks]
        dates = df[df.index.isin(test.index)].Date
        test.index = pd.to_datetime(dates)
        test_complete_index = test.reindex(self.streamflow.index)
        test_interpolated = test_complete_index.interpolate(method='linear')
        test_interpolated = test_interpolated[test_interpolated.index.isin(self.projection_period)]

        
        #self.plot_baseflow(df, T_Wind, interpolation_dates, interpolation_dates,
         #                  Date_Debut=pd.to_datetime('2011-01-01'), Date_Fin=pd.to_datetime('2021-01-01'))
        
        return test_interpolated
        #return interpolation_values, df['Interpolated_Values'].values
    

    def plot_baseflow(self, df, T_Wind, interpolation_dates, interpolation_values, Date_Debut, Date_Fin):
        
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        mpl.rcParams['figure.figsize'] = 7, 4
        
        # Plot Matplotlib
        fig, ax = plt.subplots()
        ax.plot(df['Date'], df['Q'], label='Valeur', color='grey', linewidth=0.5)
        ax.plot(df['Date'], df['Min_XX_days'], label=f'Min_{T_Wind} jours', linestyle='--', color='red')
        ax.plot(interpolation_dates, interpolation_values, label='Interpolation', linestyle=':', color='blue')
        
        # Ajouter des lignes verticales pour la date de début et de fin
        date_debut = df['Date'].min()
        date_fin = df['Date'].max()
        
        #ax.axvline(x=date_debut, color='r', linestyle='--', label='Date de début')
        #ax.axvline(x=date_fin, color='g', linestyle='--', label='Date de fin')
        
        # Ajouter des lignes verticales pour les turning points
        turning_points = df[df['Turning_Point']]
        #ax.scatter(turning_points['Date'], turning_points['Min_XX_days'], color='black', label='Turning Points', s=5)
        
        # Formater les étiquettes de l'axe des x en "dd/mm/YYYY"
        date_format = DateFormatter("%d/%m/%Y")
        ax.xaxis.set_major_formatter(date_format)
        plt.xticks(rotation=45)
        
        # Ajouter des étiquettes et un titre
        plt.xlabel('Date', fontsize=12)
        plt.ylabel('Valeur', fontsize=12)
        plt.title(self.watershed_name)
        
        # Définir les limites de l'axe des x
        plt.xlim(Date_Debut, Date_Fin)
        # plt.ylim(0, 3)
        
        # Afficher la légende
        plt.legend()
        
        # Afficher le graphique
        plt.show()
    
    
    def _get_projection_origin(self, scenarios):
        station_id_to_name = dict(zip(self.stations['ID'], self.stations['name']))
        scenarios['ID'] = scenarios['watershed']
        scenarios['watershed'] = scenarios['watershed'].map(station_id_to_name)
        n_scenarios = len(scenarios)
        return scenarios, n_scenarios

        
    def plot_watersheds(self, watersheds):
        
        gdf = self.create_watershed_geodataframe(watersheds)
        
        # Créer une carte vide
        fig = go.Figure()

        # Parcourir tous les polygones et MultiPolygons dans votre GeoDataFrame
        for index, row in gdf.iterrows():
            
            geometry = row['geometry']
            watershed_name = row['name']
            watershed_id = index
            
            # Extract and convert outlets
            gdf_outlet = watersheds[index].geographic.gdf
            gdf_outlet.crs = 'EPSG:2154'
            gdf_outlet = gdf_outlet.to_crs(epsg=4326)
            
            try:
                polygon_coords = geometry.exterior.coords.xy
                polygon_lat = list(polygon_coords[1])
                polygon_lon = list(polygon_coords[0])
        
                # Ajouter le polygone à la carte
                fig.add_trace(go.Scattermapbox(
                    lat=polygon_lat,
                    lon=polygon_lon,
                    mode="lines",
                    line=dict(width=1, color="blue"),
                    name=watershed_id,
                    text=f"{watershed_name}<br>{watershed_id}",
                    hoverinfo="text",
                ))
                
                fig.add_trace(go.Scattermapbox(
                   lat=gdf_outlet.geometry.y,
                   lon=gdf_outlet.geometry.x,
                   mode="markers",
                   marker=dict(size=8, color="red", opacity=0.8),
                   name=f"Outlets for {watershed_id}",
                   hoverinfo="none",
               ))
            except:
                print("MultiPolygon")
        
        # Personnaliser la carte
        fig.update_layout(
            mapbox=dict(
                style="open-street-map",  # Choisissez un style de carte (par exemple, "open-street-map")
            ),
            showlegend=False,
        )

                # Afficher la carte
        pyo.plot(fig)

    
    def create_watershed_geodataframe(self, watersheds):
        
        geometry = []
        watershed_name = []
        geometry_area = []
        hydro_area = []
        K1 = []
        
        watershed_id = list(watersheds.keys())
        
        
        for ws_id in watersheds.keys():
            
            # Extract the watershed geometry (delineation)
            ws_geometry = watersheds[ws_id]['geographic']['geometry']
            
            # If MultiPolygon we have to extract the widest polygon
            if isinstance(ws_geometry[0], MultiPolygon):
                print(ws_id)
                multi_polygon = ws_geometry.iloc[0]
                polygons = list(multi_polygon.geoms)
                polygon = polygons[0]
                ws_geometry = gpd.GeoDataFrame({'geometry': [polygon]}, crs=ws_geometry.crs)
                ws_geometry = ws_geometry['geometry']
            
            # Add data
            watershed_name.append(watersheds[ws_id]['hydrometry']['name'])
            geometry_area.append(((watersheds[ws_id]['geographic']['geometry'].area)/1e+6).values[0])
            hydro_area.append(watersheds[ws_id]['hydrometry']['area'])
            try:
                K1.append(watersheds[ws_id]['hydraulicprop']['calibrated_params']['k1'])
            except:
                K1.append('NaN')
            
            # Create the watershed geodataframe
            gdf = gpd.GeoDataFrame({'geometry': ws_geometry}, crs='EPSG:2154')
            gdf_wgs84 = gdf.to_crs(epsg=4326)
            geometry.append(gdf_wgs84)
        
        df = pd.DataFrame({'name':watershed_name,
                           'geometry_area':geometry_area,
                           'hydro_area':hydro_area,
                           'K1':K1})
        df.index = watershed_id
        gdf = pd.concat(geometry)
        gdf.index = watershed_id
        merged_df = pd.merge(df, gdf, left_index=True, right_index=True)
        gdf = gpd.GeoDataFrame(merged_df, geometry='geometry')
        
        return gdf

    
    def _filter_watershed_similarity(self):
        
        sim = self.watershed_similarity
        sim = sim[sim.index.isin(self.similar_watersheds)]
        sim = sim.filter(items=self.similar_watersheds, axis=1)
        
        return sim


    def plot_forecast_streamflow(self,cydre_app, df_forecast):
        
        # Get forecast watershed properties and streamflow
        forecast_year = cydre_app.date.year
        forecast_watershed = cydre_app.UserConfiguration.user_watershed_id
        df_watershed = cydre_app.watersheds[forecast_watershed]['hydrometry']['specific_discharge']
        df_watershed = df_watershed[df_watershed.index.year == forecast_year]
        
        # Preprate the plot
        months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
        tickvals = [f"{month:02d}-01" for month in range(1, 13)]    
        ticktext = [f"{months[month-1]}" for month in range(1, 13)]
        df_watershed['daily'] = df_watershed.index.strftime('%m-%d')
        df_watershed['Q'] = df_watershed['Q'] * 86400
        
        # Plot streamflow
        scatter_plot = go.Scatter(
            x = df_watershed['daily'],
            y = df_watershed['Q'],
            mode = 'lines',
            name=f"{cydre_app.watersheds[forecast_watershed]} en ({forecast_year})",
            line = dict(color='red', width=2)
            )
        
        median_plot = go.Scatter(
            x = df_forecast.index,
            y=df_forecast.Q50 * 86400,
            mode='lines',
            name='Q50',
            line=dict(color='darkblue', width=2)
        )
        
        upper_curve = go.Scatter(
            x=df_forecast.index,
            y=df_forecast.Q90 * 86400,
            mode='lines',
            name='Q90',
            line=dict(color='silver', width=2)
        )
        
        lower_curve = go.Scatter(
            x=df_forecast.index,
            y=df_forecast.Q10 * 86400,
            mode='lines',
            name='Q10',
            line=dict(color='silver', width=2)
        )
        
        fill_area = go.Scatter(
            x=df_forecast.index,  
            y=df_forecast.Q90 * 86400,
            fill='tonexty',
            mode='none',  
            name='zone incertitude',
            #fillcolor='rgba(0, 255, 255, 0.1)'  # Couleur de remplissage avec opacité
            fillcolor='rgba(191, 191, 191, 0.4)'
        )
        
        layout = go.Layout(
            xaxis=dict(title="Date"),
            yaxis=dict(title="Débit spécifique (m/j)"),
            legend=dict(
                x=0.5,           # Position horizontale (0 = gauche, 1 = droite)
                y=1.2,           # Position verticale (1 = haut, -1 = bas)
                xanchor='center', # Ancrage horizontal ('left', 'center', 'right')
                yanchor='bottom', # Ancrage vertical ('top', 'middle', 'bottom')
                orientation='h', # Orientation ('v' pour vertical, 'h' pour horizontal)
                font=dict(size=9)) # Taille de la police des légendes
        )
        
        forecast_figure = go.Figure(data=[scatter_plot, median_plot, lower_curve, fill_area, upper_curve], layout=layout)
        #forecast_figure = go.Figure(data=[scatter_plot, median_plot, fill_area], layout=layout)
        forecast_figure.update_xaxes(type="category", tickvals=tickvals, ticktext=ticktext)
        forecast_figure.update_yaxes(
            type="log",
            range=[-5, -1],
            #tickformat=".1e",
            #showexponent="last",
            exponentformat="power",
            #showline=True,
            #linewidth=2,
            showticklabels=True,
            tickfont=dict(size=10),
            #dtick=1,
        )
        forecast_figure.update_layout(
          plot_bgcolor="rgba(0,0,0,0)",
          paper_bgcolor="rgba(0,0,0,0)")
        
        pyo.plot(forecast_figure, filename='test_forecast.html')
        #plot(forecast_figure, filename='forecast_figure.html')
    
    
    def plot_seasonal_streamflow(self, Forecast, savefig=False, 
                                 fig_size=(8, 7), lw=2, 
                                 labelsize=22, ticksize=18, legendsize=12, 
                                 facecolor='cyan', alpha=0.1):
        
        # Name of the watershed
        name = Forecast.watershed_target.hydrometry.name
        year = Forecast.forecast_year
        
        # Extract streamflow from forecasting watersehd
        q_to_forecast = Forecast.df_site
        q_to_forecast = q_to_forecast['Q'] * 86400 # m/s to m/d
        
        
        
        
        # ---- Extract streamflow from simlar scenarios ----
        
        # Best scenarios based on similarity
        best_scenarios = Forecast.scenarios
        
        # Watersheds information
        watersheds_refs = [best_scenarios.iloc[1].watershed, 
                           best_scenarios.iloc[2].watershed,
                           best_scenarios.iloc[3].watershed,
                           best_scenarios.iloc[78].watershed]
        
        # Hydrological station's names
        watersheds_names = [Forecast.obs_events[watersheds_refs[0]].hydrometry.name,
                           Forecast.obs_events[watersheds_refs[1]].hydrometry.name,
                           Forecast.obs_events[watersheds_refs[2]].hydrometry.name,
                           Forecast.obs_events[watersheds_refs[3]].hydrometry.name]
        
        # Year of similarity
        watersheds_years = [best_scenarios.iloc[1].years, 
                           best_scenarios.iloc[2].years,
                           best_scenarios.iloc[3].years,
                           best_scenarios.iloc[78].years]
        
        # Extract streamflow
        idx = Forecast.df_obs["HydroYear"] == int(year)
        q_scenario_1 = Forecast.df_obs[watersheds_refs[0]] * 86400
        q_scenario_2 = Forecast.df_obs[watersheds_refs[1]] * 86400
        q_scenario_3 = Forecast.df_obs[watersheds_refs[2]] * 86400
        q_scenario_4 = Forecast.df_obs[watersheds_refs[3]] * 86400
        
        
        
        # ---- Plot the seasonal streamflow ----
        
        # Plot parameters
        mpl.rcParams.update(mpl.rcParamsDefault)
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        
        # Create the figure and axes
        fig, ax = plt.subplots(figsize=fig_size)
        
        # Add the discharge
        ax.plot(np.array(list(q_to_forecast.index)), q_to_forecast.values, color='darkblue',
                lw=2, label='{watershed} - {year}'.format(watershed=name, year=year))
        
        ax.plot(np.array(list(q_to_forecast.index)), q_scenario_1[idx].values, color='green',
                lw=0.7, linestyle = '--',
                label='{watershed} - {year}'.format(watershed=watersheds_names[0], year=watersheds_years[0]))
        
        ax.plot(np.array(list(q_to_forecast.index)), q_scenario_2[idx].values, color='red',
                lw=0.7, linestyle = '--', 
                label='{watershed} - {year}'.format(watershed=watersheds_names[1], year=watersheds_years[1]))
        
        ax.plot(np.array(list(q_to_forecast.index)), q_scenario_3[idx].values, color='magenta',
                lw=0.7, linestyle = '--', 
                label='{watershed} - {year}'.format(watershed=watersheds_names[2], year=watersheds_years[2]))
        
        ax.plot(np.array(list(q_to_forecast.index)), q_scenario_4[idx].values, color='brown',
                lw=0.7, linestyle = '--', 
                label='{watershed} - {year}'.format(watershed=watersheds_names[3], year=watersheds_years[3]))
        
        ax.tick_params(axis='x', which='both',
                       labelsize=ticksize,direction='inout', rotation=0)
        ax.tick_params(axis='y', which='both',
                       labelsize=ticksize,direction='in')
        fmt_month = mpl.dates.MonthLocator(interval = 1)
        ax.xaxis.set_major_locator(fmt_month)
        ax.xaxis.set_major_formatter(mpl.dates.DateFormatter('%m'))
        ax.set_ylim(1e-5, 1e-2)
        ax.set_yscale('log')
        ax.set_ylabel('Specific discharge (m/d)', fontsize=labelsize)
        ax.set_xlabel('Months', fontsize=labelsize)
        ax.set_title(name, fontsize=26)
        ax.legend(fontsize = legendsize, ncol=1)
        
        if savefig:
            plt.savefig(name+'.tiff', dpi=500, format="tiff", bbox_inches='tight', pad_inches=0.1)
    
        plt.show()