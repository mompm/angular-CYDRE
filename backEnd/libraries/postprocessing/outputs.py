# -*- coding: utf-8 -*-
"""
Created on Thu Jun 22 14:50:29 2023

@author: Nicolas Cornette
"""

# Python modules
import os
import pickle
import numpy as np
import plotly.colors
import matplotlib as mpl 
from matplotlib.dates import DateFormatter
import matplotlib.pyplot as plt
import pandas as pd
import geopandas as gpd
import plotly.express as px
import plotly.offline as pyo
import plotly.graph_objects as go
from shapely.geometry import MultiPolygon
from scipy.signal import find_peaks
from scipy.interpolate import interp1d


def hex_to_rgba(hex_color, alpha=1.0):
    """
    Convertit une couleur hexadécimale en format rgba avec une valeur alpha spécifiée.
    """
    hex_color = hex_color.lstrip('#')
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return f'rgba({r}, {g}, {b}, {alpha})'



class Outputs():
    
    """
    Class used to manage cydre results and do some plots.
    Note: Only outputs, all computations and analysis have been performed before
            All what is necessary for forecast is in the files of forecast and not here
    
    Attributes
    ----------
    version : string
        Usage version of the cydre application. 
        It can be 'application' to perform a standalone simulation or 'test' to perform a sensitivity analysis.
    stations : GeoDataFrame
        File with all stations.
    watershed_id : string
        Watershed id (from BanqueHydro).
    watershed_name : string
        Watershed name (explicit).
    watershed_area : float
        Area of watershed.
    initial_date : pandas Datetime
        Initial date selected by the user to start the projection (prior to recalculation).
    simulation_date : pandas Datetime
        Date set for the projections (after recalculation).
    similarity_period : DatetimeIndex
        Vector of dates on which similarity should be performed.
    projection_period : DatetimeIndex
        Vector of dates on which projections should be performed.   
    user_streamflow : DataFrame
        Time series of streamflow from the reference watershed.
    streamflow_forecast : DataFrame
        Forecast on streamflow (Q10, Q50, Q90).
    streamflow_forecast_individuals : list of DataFrame
        Individual time series used to forecast streamflow.
    storage_forecast : DataFrame
        Forecast on storage (Q10, Q50, Q90).
    station_forecast : DataFrame
        Forecast using only the data at the station, all the past years (not only the selected ones!)
        used as a reference for comparison
    
    Sensitivity analysis mode (for comparison):
    
    user_streamflow_forecast : DataFrame
        Time series of streamflow from the reference watershed extracted during the projection period.
    user_recharge_forecast : DataFrame
        Time series of recharge from the reference watershed extracted during the projection period.
    user_runoff_forecast : DataFrame
        Time series of runoff from the reference watershed extracted during the projection period.
    user_storage_forecast : DataFrame
        Time series of storage from the reference watershed extracted during the projection period.
    
    
    Methods (public)
    ----------------
    store_results(self, output_path, correlation_matrix, watershed_similarity, similar_watersheds, log=True, fig_format="html"):
        Method used to create output directories, store similarity results, and define the path for saving graphs.
    get_projections_data(self, module):
        Preparation of seasonal forecast visualization and calculation of operational indicators.
    plot_streamflow_projections(self, log=True, module=False, options='viz_matplotlib'):
        Plot projections (matplotlib or plotly).
    projections_angular_format(self, reference_df, projection_series, merged_df):
        Convert projections data in JSON format for Angular front-end.
    new_projections(self, m10):
        Methods use for add new thresholds and recalculate indicators in the cydre web application.
    plot_typology_map(self, gdf_stations, gdf_watersheds, watershed_id, clusters):
        Plot the typology map generated with the hydraulic properties.
    
    Methods (private)
    -----------------
    __manage_outputs_path(self, log, fig_format):
        Create output directories and define the path for saving graphs.
    __save_correlation_matrix(self, correlation_matrix):
        Save the correlation matrix in the watershed output folder.
    __save_watershed_similarity(self, watershed_similarity, similar_watersheds):
        Save similarities coefficients between watersheds (alltogether)
    __get_streamflow_series(self):     
        Get observation and projections time series for vizualisation.
    __calculate_module(self, reference_df):
        Calculate the streamflow module, commonly used for operational purposes to maintain minimum water levels in the stream network.
    __calculate_indicators(self, reference_df, projection_df, projection_series):
        Calculate each operationnal indicators necessary for the Cydre web application users.
    
    """
    
    def __init__(self, cydre_app, watershed_name, stations, initial_date, similarity_period, 
                 log=True, module=True, options='viz_matplotlib'):
        
        # Configuration
        self.version = cydre_app.version
        
        # Stations infos
        self.stations = stations
        self.watershed_name = watershed_name
        self.watershed_id = cydre_app.UserConfiguration.user_watershed_id
        self.watershed_area = cydre_app.UserConfiguration.user_watershed_area
        
        # Dates
        self.initial_date = initial_date
        self.simulation_date = cydre_app.date
        self.similarity_period = similarity_period
        self.projection_period = cydre_app.Forecast.forecast_period
        
        # Time series
        self.user_streamflow = cydre_app.UserConfiguration.user_streamflow
        self.streamflow_forecast = cydre_app.df_streamflow_forecast
        self.streamflow_forecast_individuals = cydre_app.Forecast.Q_streamflow_forecast_normalized
        self.watersheds_id_individuals = cydre_app.Forecast.scenario_watershed
        id_to_name = dict(zip(self.stations['ID'], self.stations['name']))
        self.watersheds_name_individuals = [id_to_name.get(station_id, station_id) for station_id in self.watersheds_id_individuals]
        self.years_individuals = cydre_app.Forecast.scenario_year
        self.storage_forecast = cydre_app.df_storage_forecast
        self.station_forecast = cydre_app.df_station_forecast
        
        
        # Only if we set the version to "test" for sensitivy analysis use.
        if self.version == 'test':
            self.user_streamflow_forecast = cydre_app.UserConfiguration.user_streamflow[cydre_app.UserConfiguration.user_streamflow.index.isin(self.projection_period)]
            self.user_recharge_forecast = cydre_app.UserConfiguration.user_recharge[cydre_app.UserConfiguration.user_recharge.index.isin(self.projection_period)]
            self.user_runoff_forecast = cydre_app.UserConfiguration.user_runoff[cydre_app.UserConfiguration.user_runoff.index.isin(self.projection_period)]
            self.user_storage_forecast = cydre_app.UserConfiguration.user_storage[cydre_app.UserConfiguration.user_storage.index.isin(self.projection_period)]
    
    
    def store_results(self, output_path, correlation_matrix, log=True, fig_format="tiff"):
        """
        Method used to create output directories, store similarity results, and define the path for saving graphs.
        """
        
        self.output_path = output_path
        self.__manage_outputs_path(log, fig_format)
        self.__save_correlation_matrix(correlation_matrix)
        #self.__save_watershed_similarity(watershed_similarity, similar_watersheds)

        
    def __manage_outputs_path(self, log, fig_format):
        """
        Create output directories and define the path for saving graphs.
        
        Parameters
        ----------
        log : boolean
            log-scale
            true: logarithmic
            false: linear
        fig_format : string
            Format in which graphs/figures are saved    
            "html"
            "tiff"
        """
        
        # Watershed folder for storing outputs as plots
        self.__watershed_path = os.path.join(self.output_path, self.watershed_id)
        self.__simulation_path = os.path.join(self.__watershed_path, self.initial_date)
        
        if not os.path.exists(self.__watershed_path):
            os.makedirs(self.__watershed_path)
        if not os.path.exists(self.__simulation_path):
            os.makedirs(self.__simulation_path)
        
        # Watershed folder for storing outputs as plots
        if fig_format=='tiff' and log==True:
            self.streamflow_fig_path = os.path.join(self.__watershed_path, f"log_{self.initial_date}.tiff")
        elif fig_format=='tiff' and log==False:
            self.streamflow_fig_path = os.path.join(self.__watershed_path, f"lin_{self.initial_date}.tiff")
        elif fig_format=='html' and log==True:
            self.streamflow_fig_path = os.path.join(self.__watershed_path, f"log_{self.initial_date}.html")
        elif fig_format=='html' and log==False:
            self.streamflow_fig_path = os.path.join(self.__watershed_path, f"lin_{self.initial_date}.html")
        
    
    def __save_correlation_matrix(self, correlation_matrix):
        """
        Save the correlation matrix in the watershed output folder. 
        """
        
        filename = os.path.join(self.__simulation_path, 'corr_matrix.txt')
        correlation_matrix.to_csv(filename)
    
    
    def __save_watershed_similarity(self, watershed_similarity, similar_watersheds):
        """
        Save similarities coefficients between watersheds (alltogether)

        Parameters
        ----------
        watershed_similarity : dataframe
            Lines and columns (basins), 
            value: indicator (between 0 and 1)
        similar_watersheds : list of strings
            List of watershed which are effectively similar
            Eventually, only those watersheds will be kept for the display
        """
        
        filename = os.path.join(self.output_path, self.watershed_id, 'watershed_similarity.txt')
        df = watershed_similarity
        df = df[df.index.isin(similar_watersheds)]
        df = df.filter(items=similar_watersheds, axis=1)
        
        df.to_csv(filename)
    
    
    def get_projections_data(self, module):
        """
        Preparation of seasonal forecast visualization and calculation of operational indicators.

        Parameters
        ----------
        module : boolean
            should it be displayed on streamflow figure

        Returns
        -------
        reference_df : dataframe
            Observations
        projection_df : dataframe
            Projections (q10, q50, q90, qmean)
            Already computed before (no weighting involved, as it is already done if should be)
        projection_series : list of dataframes
            All chronicles used
        merged_df : dataframe
            combination of reference_df and projection_df

        """
        
        # Extract observation and projection timeseries data
        reference_df, projection_df, projection_series = self.__get_streamflow_series()
        
        # Calculate the module (1/10 x mean streamflow)
        if module:
            self.mod, self.mod10 = self.__calculate_module(reference_df)
            self.__calculate_indicators(reference_df, projection_df, projection_series)
        
        # Merge observation and projection timeseries data
        merged_df = pd.merge(reference_df, projection_df, left_on=reference_df.index,
                             right_on=projection_df.index, how='right')
        merged_df = merged_df.set_index(merged_df['key_0'])
        
        return reference_df, projection_df, projection_series, merged_df
    
   
    def __get_streamflow_series(self):     
        """
        Get observation and projections time series for vizualisation.
        """
   
        # Observation
        reference_df = self.user_streamflow.copy()
        reference_df['daily'] = reference_df.index.strftime('%m-%d')
        # Conversion of surface from km^2 to m^2
        reference_df['Q'] *= (self.watershed_area * 1e6) # m/s > m3/s
        
        # Projections
        projection_df = self.streamflow_forecast.copy()
        projection_df = projection_df.set_index(self.projection_period)
        projection_df *= self.watershed_area * 1e6 # m/s > m3/s
        
        # Individual projections
        projection_series = []
        
        for serie in self.streamflow_forecast_individuals:
            serie = pd.DataFrame(serie)
            serie['Q_streamflow'] *= (self.watershed_area * 1e6)
            serie = serie.set_index(self.projection_period)
            projection_series.append(serie)
        
        return reference_df, projection_df, projection_series
    
    
    def __calculate_module(self, reference_df):
        """
        Calculate the streamflow module, commonly used for operational purposes to maintain minimum water levels in the stream network. 

        Parameters
        ----------
        reference_df : dataframe
            Observations

        """
        reference_df['year'] = reference_df.index.year
        df = reference_df.groupby('year')['Q'].mean()
        mod = df.mean()
        mod10 = mod/10
        return mod, mod10
    
    
    def __calculate_indicators(self, reference_df, projection_df, projection_series):
        
        """
        Calculate each operationnal indicators necessary for the Cydre web application users.
            
        """
        # Projected streamflow (last day value and evolution)
        self.proj_values = projection_df.iloc[-1]
        Qobs_ti = reference_df.loc[self.simulation_date].Q
        self.proj_values_ev = round((self.proj_values['Q50'] - Qobs_ti)/Qobs_ti * 100, 2)
        
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
     
    
    def plot_streamflow_projections(self, log=True, module=False, stats_stations=False, options='viz_matplotlib'):
        """
        Plot projections (matplotlib or plotly)/

        Parameters
        ----------
        log : bool 
            log-scale
        module : bool
            should module be displayed (red horizontal line)
        stats_stations : bool
            Trends forecasted from analysis without any similarity are added to the graph (True option).
        options : string
            Matplotlib -> tiff
            Plotly -> html

        Returns
        -------
        fig : plotly.graph_objects
            the handle to the figure

        """
        
        reference_df, projection_df, projection_series, merged_df = self.get_projections_data(module)
        
        if stats_stations:
            station_df = self.station_forecast.copy()
            station_df = station_df.set_index(self.projection_period)
            station_df *= self.watershed_area * 1e6 # m/s > m3/s
        
        
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
            
            # Add data obtained from stastical analysis at the station (wihout any similarity)
            if stats_stations:
                ax.fill_between(merged_df.index, station_df['Q10'], station_df['Q90'], color='purple',
                                alpha=0.1, edgecolor='purple', linewidth=0, label="zone d'incertitude [station]")
                
                ax.plot(merged_df.index, station_df['Q10'], color='purple', linewidth=0.3)        
                ax.plot(merged_df.index, station_df['Q90'], color='purple', linewidth=0.3)
                ax.plot(merged_df.index, station_df['Q50'], color='purple', linewidth=1.5, linestyle='dotted',
                       label='stats sur la station')


            # Add the observations
            ax.plot(reference_df.index, reference_df['Q'], color='k', linewidth=1,
                label="observation")
            
            # Add a vertical line representing the simualtion date
            ax.axvline(x=self.simulation_date, color='k', linestyle='--', linewidth=0.8)
            
            # Add module if selected by the user
            if module:
                ax.axhline(y=self.mod10, color='r', linestyle='--', linewidth=0.6, label='1/10 du module')
            
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
            ax.set_title(f"{self.watershed_name}", fontsize=14)
            
            if self.streamflow_fig_path:
                plt.savefig(self.streamflow_fig_path, dpi=500, format="tiff", pil_kwargs={"compression": "tiff_lzw"},
                            bbox_inches='tight', pad_inches=0.1)
            return fig
        
        elif options == 'viz_plotly':
            
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
                                        line=dict(color='grey', width=0.25, dash='dash'),
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
            

            # Add module if selected by the user
            if module:
                fig.add_trace(go.Scatter(
                    x=[merged_df.index.min(), merged_df.index.max()],
                    y=[self.mod10, self.mod10],
                    mode='lines',
                    line=dict(color="red", width=1),
                    name='1/10 du module'
                ))

            # Set axis parameters
            fig.update_xaxes(range=[self.similarity_period[0], self.projection_period[-1]], 
                             tickformat="%d-%m-%Y",
                             type='date',
                             tickfont = dict(size=14, family='Segoe UI Semibold', color='black'),
                             gridwidth = 0.01,
                             gridcolor = 'rgba(0,0,0,0.1)',
                             )
            
            fig.update_yaxes(range=[1e-3, None],
                             #showgrid=False,
                             type='log' if log else None,
                             title="Débit (m3/s)",
                             rangemode='tozero',
                             tickfont = dict(size=14, family='Segoe UI Semibold', color='black'),
                             gridwidth = 0.01,
                             gridcolor = 'rgba(0,0,0,0.1)',
                             )

            fig.update_layout(title=f"{self.watershed_id} | {self.watershed_name}", 
                              width=1200,
                              height=675,
                              legend=dict(x=0.5, y=1.1, orientation="h", xanchor='center'),
                              title_x = 0.5,
                              hovermode = "x unified",
                              plot_bgcolor = "rgba(0,0,0,0)",
                              paper_bgcolor = "rgba(0,0,0,0)",)
            
            # Save and show plot
            if self.streamflow_fig_path:
                fig.write_html(self.streamflow_fig_path)
            
            pyo.plot(fig)
            
            return fig
     
        
    def projections_angular_format(self, reference_df, projection_series, merged_df):
        """
        Convert projections data in JSON format for Angular front-end.
        Figures will be done in the frontend

        Parameters
        ----------
        reference_df : TYPE
            DESCRIPTION.
        projection_series : TYPE
            DESCRIPTION.
        merged_df : TYPE
            DESCRIPTION.

        Returns
        -------
        data : dictionary (json)
            All the data necessary for the display in angular

        """
                
        #On ne stocke pas les données en x qui sont des dates générables dans le front
        data =[
            go.Scatter(x=None, y=merged_df['Q90'].tolist(), mode='lines', line=dict(color='#407fbd', width=1), name="Q90").to_plotly_json(),
            go.Scatter(x=None, y=merged_df['Q50'].tolist(), mode='lines', line=dict(color='blue', width=1.5, dash='dot'), name='Q50').to_plotly_json(),
            go.Scatter(x=None, y=merged_df['Q10'].tolist(), mode='lines', line=dict(color='#407fbd', width=1), name="Q10").to_plotly_json(),
            go.Scatter(x=None, y=reference_df['Q'].tolist(), mode='lines', line=dict(color='black', width=1.5), name="observations").to_plotly_json()
        ]

        # Convert each projection series DataFrame to a Plotly trace
        for idx, serie in enumerate(projection_series):
            serie_trace = go.Scatter(
                x=None, #On ne stocke pas les données en x qui sont des dates générables dans le front
                y=serie['Q_streamflow'].tolist(),
                mode='lines',
                line=dict(color='rgba(0, 0, 255, 0.2)', width=1),  # Semi-transparent blue lines
                name=f'Projection {idx + 1}'
            ).to_plotly_json()
            data.append(serie_trace)

        data = {
        'graph': data,
        'first_observation_date': reference_df.index.tolist()[0].isoformat(),#la première date d'observations
        'last_observation_date': reference_df.index.tolist()[len(reference_df.index.tolist())-1].isoformat(),#la dernière date d'observations
        'first_prediction_date': merged_df.index.tolist()[0].isoformat(),#la première date de perdicitions
        'last_prediction_date': merged_df.index.tolist()[len(merged_df.index.tolist())-1].isoformat(),#la dernière date de predictions
        'proj_values': {
            'Q50': float(self.proj_values.Q50),
            'Q10': float(self.proj_values.Q10),
            'Q90': float(self.proj_values.Q90)
        },
        'proj_values_ev': float(self.proj_values_ev),
        'ndays_before_alert':{
            'Q50': float(self.ndays_before_alert_Q50),
            'Q90': float(self.ndays_before_alert_Q90),
            'Q10': float(self.ndays_before_alert_Q10)
        },
        'ndays_below_alert': {
            'Q50': float(self.ndays_below_alert['Q50']),
            'Q90': float(self.ndays_below_alert['Q90']),
            'Q10': float(self.ndays_below_alert['Q10'])
        },
        'prop_alert_all_series': float(self.prop_alert_all_series),
        'volume50': float(self.volume50),
        'volume10': float(self.volume10),
        'volume90': float(self.volume90),
        'last_date': self.projection_period[-1].strftime("%d/%m/%Y"),
        'first_date': self.simulation_date.strftime('%d/%m/%Y'),
        # 'first_date': self.simulation_date.strftime('%Y-%m-%d'),
        'm10':self.mod10
        }
        
        return data
    
    
    def new_projections(self, m10):
        """
        Methods use for add new thresholds and recalculate indicators in the cydre web application.

        Parameters
        ----------
        m10 : float
            threshold selected (not only 10ème du module)

        Returns
        -------
        results : json dictionary
            indicators.

        """
        
        reference_df, projection_df, projection_series = self.__get_streamflow_series()
        
        # Update the module calculation
        self.mod10 = m10
        
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

        #NICOLAS: factorisation du calcul des indicateurs

        # Initialize volumes
        self.volume10 = 0
        self.volume50 = 0
        self.volume90 = 0
        

        # Ensure proper calculation and error handling for each volume
        try:
            alert_df = projection_df[projection_df['Q10'] <= self.mod10]
            q_values = alert_df['Q10'] * 86400
            self.volume10 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume10 calculation: {e}")

        try:
            alert_df = projection_df[projection_df['Q50'] <= self.mod10]
            q_values = alert_df['Q50'] * 86400
            self.volume50 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume50 calculation: {e}")

        try:
            alert_df = projection_df[projection_df['Q90'] <= self.mod10]
            q_values = alert_df['Q90'] * 86400
            self.volume90 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume90 calculation: {e}")

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

        results = {
            'volume50': float(self.volume50),
            'volume10': float(self.volume10),
            'volume90': float(self.volume90),
            'prop_alert_all_series': float(self.prop_alert_all_series),
            'ndays_before_alert':{
                'Q10': float(self.ndays_before_alert_Q10),
                'Q50': float(self.ndays_before_alert_Q50),
                'Q90': float(self.ndays_before_alert_Q90),
            },
            'ndays_below_alert': {
                'Q10': float(self.ndays_below_alert['Q10']),
                'Q50': float(self.ndays_below_alert['Q50']),
                'Q90': float(self.ndays_below_alert['Q90']),
            },
        }
        return results
    
    
    def plot_typology_map(self, gdf_stations, gdf_watersheds, watershed_id, clusters):
        """
        Plot the typology map generated with the hydraulic properties.
        Note: Map is the geographic representation
                Classes are represented by dots of different colors

        Parameters
        ----------
        gdf_stations : TYPE
            DESCRIPTION.
        gdf_watersheds : TYPE
            DESCRIPTION.
        watershed_id : TYPE
            DESCRIPTION.
        clusters : TYPE
            DESCRIPTION.

        Returns
        -------
        fig : TYPE
            DESCRIPTION.

        """
        
        gdf_stations_filter = gdf_stations[gdf_stations["ID"].isin(clusters.index)]
        gdf_watersheds_filter = gdf_watersheds[gdf_watersheds.index.isin(clusters.index)]
        gdf_watersheds_filter = gdf_watersheds_filter.merge(clusters[['typology']], left_index=True, right_index=True, how='left')
        gdf_watersheds_filter['typology'] = gdf_watersheds_filter['typology'].astype(str)        
        
        colors = {
        '0': '#1f77b4',  # Bleu
        '1': '#ff7f0e',  # Orange
        '2': '#2ca02c',  # Vert
        '3': '#d62728',  # Rouge
        '4': '#9467bd',  # Violet
        '5': '#8c564b',  # Marron
        '6': '#e377c2'   # Rose
        }


        fig = px.choropleth_mapbox(
            gdf_watersheds_filter,
            geojson=gdf_watersheds_filter.geometry,
            locations=gdf_watersheds_filter.index,
            color="typology",
            hover_name="name",  # Optionnel, pour afficher le nom au survol
            title="Typologies des bassins versants",
            color_discrete_map=colors
        )
        
        
        # Mettre à jour la carte pour utiliser un style mapbox approprié
        fig.update_geos(fitbounds="locations", visible=False)
        fig.update_layout(mapbox_style="open-street-map", mapbox_zoom=6.8, mapbox_center={"lat": 48.2141667, "lon": -2.9424167})
        #fig.update_coloraxes(colorbar=dict(visible=False))
        
        # Afficher la figure
        fig.show()
        fig.write_html(os.path.join(self.__watershed_path, "typo2.html"))
        

        return fig

    
#NICOLAS: à déplacer dans l'analyse de sensibilité
    def save_performance(self, model_quality):
        """
        Saves dictionary issued by the sensitivity analysis
        """
        
        filename = os.path.join(self.__simulation_path, 'model_quality.pkl')
        
        with open(filename, 'wb+') as f:
            pickle.dump(model_quality, f, pickle.HIGHEST_PROTOCOL)
        
        #with open(filename, 'w') as file:
            #json.dump(model_quality, file)
    
    
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
        df_proj = self.streamflow_forecast.copy() * self.watershed_area * 1e6
        self.volume_proj = pd.Series.cumsum(df_proj)
        self.volume_proj *= 86400
        
        # Cumulated volume for observation series
        if self.version == 'test':
            df_user = self.user_streamflow_forecast.copy() * self.watershed_area * 1e6
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
        df_proj = self.storage_forecast.copy() * self.watershed_area * 1e6
        self.storage_forecast = pd.Series.cumsum(df_proj)
        self.storage_forecast *= 86400
        
        # Cumulated volume for observation series
        if self.version == 'test':
            df_user = self.user_storage_forecast.copy() * self.watershed_area * 1e6
            self.storage_user = pd.Series.cumsum(df_user)
            self.storage_user *= 86400
        
        
    def plot_storage_variations(self):
        
        filename = os.path.join(self.watershed_path, f"storage_{str(self.simulation_date.date())}.tiff")
        
        # Plot initialization
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        mpl.rcParams['figure.figsize'] = 5, 5
        
        fig, ax = plt.subplots()
        
        ax.fill_between(self.storage_user['Q'].index, self.storage_forecast['Q10'], self.storage_forecast['Q90'], color='#407fbd',
                        alpha=0.20, edgecolor='#407fbd', linewidth=0, label="zone d'incertitude")
        ax.plot(self.storage_user['Q'].index, self.storage_forecast['Q10'], color='#407fbd', linewidth=0.3)        
        ax.plot(self.storage_user['Q'].index, self.storage_forecast['Q90'], color='#407fbd', linewidth=0.3)
        
        # Add observation and projection storage variations lines
        ax.plot(self.storage_user['Q'].index, self.storage_user['Q'], color='black', label='observation')
        ax.plot(self.storage_user['Q'].index, self.storage_forecast['Q50'], color='blue', linestyle='--', label='projection médiane')
        ax.plot(self.storage_user['Q'].index, self.storage_forecast['Qmean'], color='blue', linestyle='-', linewidth=0.5, label='projection moyenne')
        
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
    
    
    #NICOLAS: supprimer ou mettre à jour
    def _get_projection_origin(self, scenarios):
        station_id_to_name = dict(zip(self.stations['ID'], self.stations['name']))
        scenarios['ID'] = scenarios['watershed']
        scenarios['watershed'] = scenarios['watershed'].map(station_id_to_name)
        n_scenarios = len(scenarios)
        return scenarios, n_scenarios
    
    
    def plot_watersheds(self, gdf, similar_watersheds=None):
        
        if similar_watersheds is not None:
            gdf = gdf[gdf.index.isin(similar_watersheds)]
        else:
            gdf = gdf
        
        # Créer une carte vide
        fig = go.Figure()

        # Parcourir tous les polygones et MultiPolygons dans votre GeoDataFrame
        for index, row in gdf.iterrows():
            
            geometry = row['geometry']
            watershed_name = row['name']
            watershed_id = index
                        
            try:
                polygon_coords = geometry.exterior.coords.xy
                polygon_lat = list(polygon_coords[1])
                polygon_lon = list(polygon_coords[0])
        
                # Ajouter le polygone à la carte
                fig.add_trace(go.Scattermapbox(
                    lat=polygon_lat,
                    lon=polygon_lon,
                    mode="lines",
                    line=dict(width=1, color="black"),
                    name=watershed_id,
                    text=f"{watershed_name}<br>{watershed_id}",
                    hoverinfo="text",
                ))
            except:
                print("MultiPolygon")
        
        # Personnaliser la carte
        fig.update_layout(
            mapbox=dict(
                style="open-street-map",  # Choisissez un style de carte (par exemple, "open-street-map")
                center=dict(lat=48.2141667, lon=-2.9424167),
                zoom=6.8,
            ),
            showlegend=False,
        )

        # Afficher la carte
        pyo.plot(fig)
        
    
    def seasonal_hydrograph(self, watershed_ids, hydro_path):
    
        if not watershed_ids:
            raise ValueError("Au moins un bassin versant doit être fourni.")
        
        # Couleurs prédéfinies pour les bassins
        colors = ['#1f77b4', '#2ca02c', '#ff7f0e', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
        fig = go.Figure()
        
        amplitudes = []
        
        for i, watershed_id in enumerate(watershed_ids):
            
            try:
                watershed_name = self.stations[self.stations['ID'] == watershed_id].name.values[0]
                watershed_area = self.stations[self.stations['ID'] == watershed_id]['area'].values[0]
                print(watershed_name)
                
                # Lecture des données
                df = pd.read_csv(os.path.join(hydro_path, f'{watershed_id}.csv'), delimiter=',')
                df['t'] = pd.to_datetime(df['t'])
                df = df.set_index('t')
                df['year'] = df.index.year
                df['daily'] = df.index.strftime('%m-%d')
                
                # Calcul des statistiques saisonnières
                q10 = (df.groupby('daily')['Q'].quantile(0.1)) * 86400 / (watershed_area*1e6)
                q50 = (df.groupby('daily')['Q'].median()) * 86400 / (watershed_area*1e6)
                q90 = (df.groupby('daily')['Q'].quantile(0.9)) * 86400 / (watershed_area*1e6)
                
                # Calcul de l'amplitude pour q50
                q50_max = q50.max()
                q50_min = q50.min()
                amplitude = q50_max / q50_min
                
                # Stocker le nom du bassin et l'amplitude dans une liste
                amplitudes.append((watershed_name, amplitude))
                
                # Ajout de la trace pour la médiane
                fig.add_trace(go.Scatter(
                    x=q50.index,
                    y=q50,
                    name=f"{watershed_name} [{df['year'].min()} - {df['year'].max()}]",
                    line=dict(color=colors[i % len(colors)], width=2.5),
                    visible='legendonly'  # Désactive la courbe par défaut
                ))
                
                # Ajout de la trace pour la variabilité
                fig.add_trace(go.Scatter(
                    x=q10.index.tolist() + q10.index[::-1].tolist(),
                    y=q10.tolist() + q90[::-1].tolist(),
                    fill='toself',
                    fillcolor=hex_to_rgba(colors[i % len(colors)], 0.01),  # Opacité élevée (0.1)
                    line=dict(color='rgba(0, 0, 0, 0)'),
                    hoverinfo='none',
                    showlegend=False,
                    visible=False
                ))
            except:
                print(f"Error with {watershed_id}")
        
        # Tri des amplitudes par ordre décroissant
        amplitudes.sort(key=lambda x: x[1], reverse=True)
        
        # Affichage du classement
        print("\nClassement des bassins par amplitude décroissante :")
        for rank, (watershed_name, amplitude) in enumerate(amplitudes, start=1):
            print(f"{rank}. {watershed_name}: {amplitude:.4f} m³/s")
    
        # Configuration des axes
        months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
        
        fig.update_xaxes(
            type="category",
            tickvals=[f"{month:02d}-01" for month in range(1, 13)],
            ticktext=[months[month-1] for month in range(1, 13)],
            tickfont=dict(size=14, family='Segoe UI Semibold', color='black'),
            gridwidth=0.01,
            gridcolor='rgba(0,0,0,0.1)'
        )
        
        fig.update_yaxes(
            title=dict(text="Débit de cours d'eau [m3/s]", font=dict(size=14, family='Segoe UI Semibold', color='black')),
            type="log",
            exponentformat="power",
            showticklabels=True,
            tickfont=dict(size=14, family='Segoe UI Semibold', color='black'),
            gridwidth=0.01,
            gridcolor='rgba(0,0,0,0.1)',
            range=[-5, -2]
        )
    
        # Mise à jour de la mise en page pour un fond blanc
        fig.update_layout(
            paper_bgcolor='white',  # Fond de la zone extérieure
            plot_bgcolor='white',   # Fond de la zone de tracé
            margin=dict(l=50, r=50, t=50, b=50)
        )
    
        pyo.plot(fig)
        
    

    #NICOLAS: supprimer ou mettre à jour
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


        
    
    #NICOLAS: supprimer ou mettre à jour
    def __calculate_baseflow(self):
       
       df = self.user_streamflow.copy() #* self.watershed_area * 1e6
       
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
       test_complete_index = test.reindex(self.user_streamflow.index)
       test_interpolated = test_complete_index.interpolate(method='linear')
       test_interpolated = test_interpolated[test_interpolated.index.isin(self.projection_period)]
       
       return test_interpolated
   
    def plot_streamflow_projections_test(self, log=True, module=False, stats_stations=False, options='viz_matplotlib'):
        """
        Plot projections (matplotlib or plotly)/

        Parameters
        ----------
        log : bool 
            log-scale
        module : bool
            should module be displayed (red horizontal line)
        stats_stations : bool
            Trends forecasted from analysis without any similarity are added to the graph (True option).
        options : string
            Matplotlib -> tiff
            Plotly -> html

        Returns
        -------
        fig : plotly.graph_objects
            the handle to the figure

        """
        
        reference_df, projection_df, projection_series, merged_df = self.get_projections_data(module)
        
        if stats_stations:
            station_df = self.station_forecast.copy()
            station_df = station_df.set_index(self.projection_period)
            station_df *= self.watershed_area * 1e6 # m/s > m3/s
        
        
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
            
            # Add data obtained from stastical analysis at the station (wihout any similarity)
            if stats_stations:
                ax.fill_between(merged_df.index, station_df['Q10'], station_df['Q90'], color='purple',
                                alpha=0.1, edgecolor='purple', linewidth=0, label="zone d'incertitude [station]")
                
                ax.plot(merged_df.index, station_df['Q10'], color='purple', linewidth=0.3)        
                ax.plot(merged_df.index, station_df['Q90'], color='purple', linewidth=0.3)
                ax.plot(merged_df.index, station_df['Q50'], color='purple', linewidth=1.5, linestyle='dotted',
                       label='stats sur la station')


            # Add the observations
            ax.plot(reference_df.index, reference_df['Q'], color='k', linewidth=1,
                label="observation")
            
            # Add a vertical line representing the simualtion date
            ax.axvline(x=self.simulation_date, color='k', linestyle='--', linewidth=0.8)
            
            # Add module if selected by the user
            if module:
                ax.axhline(y=self.mod10, color='r', linestyle='--', linewidth=0.6, label='1/10 du module')
            
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
            ax.set_title(f"{self.watershed_name}", fontsize=14)
            
            if self.streamflow_fig_path:
                plt.savefig(self.streamflow_fig_path, dpi=500, format="tiff", pil_kwargs={"compression": "tiff_lzw"},
                            bbox_inches='tight', pad_inches=0.1)
            return fig
        
        elif options == 'viz_plotly':
            
            # Plot initialization
            plt.style.use('seaborn-dark-palette')
            plt.rcParams.update({'font.family':'Arial'})
            
            fig = go.Figure()
            
            # Add the individual series used for the projections trends with different colors
            colors = plotly.colors.qualitative.Alphabet
            
            for i, line in enumerate(projection_series):
                
                station_name = self.watersheds_name_individuals[i]  # Obtenir la station correspondante
                year = self.years_individuals[i]  # Obtenir l'année correspondante
                name = f"{station_name} - ({year})"  # Combiner les deux infos pour la légende
                
                fig.add_trace(go.Scatter(
                    x=line.index, 
                    y=line['Q_streamflow'], 
                    mode='lines', 
                    line=dict(color=colors[i % len(colors)], width=1),  # Convert to RGB and add alpha = 1
                    name=name
                ))
            
            # Add the real data measured at the hydrological station
            fig.add_trace(go.Scatter(
                x=reference_df.index, 
                y=reference_df['Q'], 
                mode='lines', 
                line=dict(color='black', width=1.5), 
                name="Observation"
            ))
            
            # Add a vertical line representing the simulation date
            max_value = np.nanmax([
                reference_df.loc[self.similarity_period]['Q'].max()
            ])
            
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
            
            
            # Set axis parameters
            fig.update_xaxes(range=[self.similarity_period[0], self.projection_period[-1]], 
                             tickformat="%d-%m-%Y",
                             type='date',
                             tickfont = dict(size=14, family='Segoe UI Semibold', color='black'),
                             gridwidth = 0.01,
                             gridcolor = 'rgba(0,0,0,0.1)',
                             )
            
            fig.update_yaxes(range=[1e-3, None],
                             type='log' if log else None,
                             title="Débit (m3/s)",
                             rangemode='tozero',
                             tickfont = dict(size=14, family='Segoe UI Semibold', color='black'),
                             gridwidth = 0.01,
                             gridcolor = 'rgba(0,0,0,0.1)',
                             )
            
            fig.update_layout(title=f"{self.watershed_id} | {self.watershed_name}", 
                              width=1200,
                              height=675,
                              legend=dict(
                                  x=1,  # Positionnement sur l'axe x
                                  y=0.5,  # Centré verticalement
                                  xanchor='left',  # Ancrage à gauche pour décaler la légende vers l'extérieur
                                  yanchor='middle',
                                  orientation="v",  # Légende verticale
                                ),
                              title_x = 0.5,
                              hovermode = "x unified",
                              plot_bgcolor = "rgba(0,0,0,0)",
                              paper_bgcolor = "rgba(0,0,0,0)",)
            
            # Save and show plot
            if self.streamflow_fig_path:
                fig.write_html(self.streamflow_fig_path)
            
            pyo.plot(fig)
            
            return fig