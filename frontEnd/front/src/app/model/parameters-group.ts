// Array<string> instead of string because it caused some display bug

export interface ParametersGroup {
    // parent?: ParametersGroup,
    name: Array<string>,
    Parameter?: Array<Parameter>,
    ParametersGroup?: Array<ParametersGroup>
}

export interface Parameter{
    // parent?: ParametersGroup,
    name: Array<string>,
    description: Array<string>,
    possible_values: Array<string>,
    type: Array<string>,
    value: Array<string>,
    default_value: Array<string>
}

// export function getFullPathParam(param: ParametersGroup | Parameter | undefined): Array<string> {
// 	if(param === undefined) {
// 		return [];
// 	}
// 	return [...getFullPathParam(param.parent), ...param.name];
// }