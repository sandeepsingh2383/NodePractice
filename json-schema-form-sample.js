// Advanced conditional fields example
// 
// Control the visibility of any field by adding a "condition" property to the
// field's UI Schema. The condition should evaluate to either true or false
// based on the current value(s) of other field(s), e.g. someField=someValue.
// The evaluation is done dynamically upon any change in the form data.
//
// Supported conditions in this example are:
//   foo=bar
//   foo!=bar
//   foo=bar,baz
//   foo!=bar,baz
//   foo=bar&&bar=foo
//   foo=bar||bar=foo
//
//   ...and some permutations of these.
//
// Please note that complex conditions do not work, e.g.
// foo=bar||bar=foo&&baz=bar
//
let promises = [];
const originalSchema = {
	title: 'Account Opening UI',
  type: 'object',
  properties: {
    registration: {
    	type: 'string',
      enum: [],
      enumNames: [],
      title: 'Account Registration',
      serverValueKeyName: 'registrationId',
      serverValueLabelName: 'registrationName',
      dataSourceUrl: 'http://localhost:3000/registrations'
    },
    program: {
    	type: 'string',
      title: 'Program',
      serverValueKeyName: 'programId',
      serverValueLabelName: 'programName',
      enum: [],
      enumNames: [],
      dataSourceUrl: 'http://localhost:3000/programs'
    },
    strategy: {
    	type: 'string',
      title: 'Strategy',
      serverValueKeyName: 'strategyId',
      serverValueLabelName: 'strategyName',
      enum: [],
      enumNames: [],
      dataSourceUrl: 'http://localhost:3000/strategies'
    },
    friends: {
    	type: 'object',
      title: 'Friends And Family',
      properties: {
      	registration: {
          type: 'string',
          enum: [],
          enumNames: [],
          title: 'Account Registration2',
          serverValueKeyName: 'registrationId',
          serverValueLabelName: 'registrationName',
          dataSourceUrl: 'http://localhost:3000/registrations'
        },
        program: {
          type: 'string',
          title: 'Program2',
          serverValueKeyName: 'programId',
          serverValueLabelName: 'programName',
          enum: [],
          enumNames: [],
          dataSourceUrl: 'http://localhost:3000/programs'
        },
        strategy: {
          type: 'string',
          title: 'Strategy2',
          serverValueKeyName: 'strategyId',
          serverValueLabelName: 'strategyName',
          enum: [],
          enumNames: [],
          dataSourceUrl: 'http://localhost:3000/strategies'
        }
      }
    }
  }
};
const originalUISchema = {
  'ui:order': ['registration','program','strategy', 'friends'],
  strategy: {
    condition: 'program=111,222,333'
  }
};
const originalFormData = {};

// Process the initial state for the form.
// Without this step, all fields would be shown initially.
const initialState = processForm(originalSchema, originalUISchema, originalSchema, originalUISchema, originalFormData);

const Form = JSONSchemaForm.default;

class MyComp extends React.Component {
    constructor (props) {
        super(props);
        this.state = initialState;
    }
    
    componentDidMount () {
    	getInitialJsonSchemaData(initialState.schema, initialState.uiSchema, 				initialState.formData).then((data)=>{
          this.setState(data);
          console.log(data);
        });
    }

    handleChange (data) {
    		console.log(arguments);
        const schema = { ...this.state.schema };
        const uiSchema = { ...this.state.uiSchema };
        const { formData } = data;
				console.log('====', this.state);
        //const newState = processForm(originalSchema, originalUISchema, schema, uiSchema, formData);
        console.log(formData);
        
        handleFieldChange(schema, uiSchema, formData).then((updatedState)=>{
        	this.setState(updatedState);
          console.log(updatedState);
        });
    }

    render () {
        return (<Form
                schema={this.state.schema}
                uiSchema={this.state.uiSchema}
                formData={this.state.formData}
                onChange={this.handleChange.bind(this)}
            />);
    }
}

ReactDOM.render(<MyComp/>, document.getElementById('main'));


/**
 * Calculate new state for form based on UI Schema field conditions and current form data
 *
 * @param originalSchema - Original full schema containing all possible fields
 * @param originalUISchema - Original full UI Schema containing all possible fields
 * @param schema - Current schema
 * @param uiSchema - Current UI schema
 * @param formData - Current form data
 * @return {object} - Object containing new schema, uiSchema, and formData
 */
function processForm (originalSchema, originalUISchema, schema, uiSchema, formData) {
    let newSchema, newUISchema, newFormData;

    let conditionalFields = _.pickBy(uiSchema, (field) => field.hasOwnProperty('condition'));

    if (_.isEmpty(conditionalFields)) {
        return {
            schema,
            uiSchema,
            formData
        };
    }

    newSchema = _.assign({}, schema);
    newUISchema = _.assign({}, uiSchema);
    newFormData = _.assign({}, formData);

    _.each(conditionalFields, (dependantSchema, dependant) => {
        const { rules, allHaveToMatch } = getConditionRules(dependantSchema.condition);
        let matches = [];
        _.each(rules, (rule) => {
            const { field, values: stringValues, invert } = getConditionRule(rule);
            let visible = invert;

            const values = stringValues.map(value => {
                if (value === 'true') {
                  	value = true;
                } else if (value === 'false') {
                  	value = false;
                }
                return value;
            });

						if (field && newFormData.hasOwnProperty(field)) {
                let currentValues = _.isArray(newFormData[field])
                		? newFormData[field]
                    : [ newFormData[field] ];
                _.each(values, (value) => {
                    if (invert) {
                      	visible = visible && _.indexOf(currentValues, value) === -1;
                    }
                    else {
                        visible = visible || _.indexOf(currentValues, value) !== -1;
                    }
                });
            }

            matches.push(visible);
        });

        // Add or remove conditional field from schema
        let shouldBeVisible = false;
        if (matches.length) {
            shouldBeVisible = allHaveToMatch
                // foo=bar && bar=foo
                ? _.every(matches, Boolean)
                // foo=bar || bar=foo
                : _.some(matches, Boolean);
        }

        if (shouldBeVisible) {
            newSchema.properties[dependant] = originalSchema.properties[dependant];
        } else {
            newSchema.properties = _.omit(newSchema.properties, [dependant]);
            newFormData = _.omit(newFormData, [dependant]);
        }
    });

    // Update UI Schema UI order
    // react-jsonschema-form cannot handle extra properties found in UI order
    newUISchema['ui:order'] = _.intersection(
        originalUISchema['ui:order'],
        _.keys(newSchema.properties)
    );
    // Update Schema required fields
    if (originalSchema.hasOwnProperty('required')) {
        newSchema.required = _.intersection(
            originalSchema.required,
            _.keys(newSchema.properties)
        );
    }

    return {
        schema: newSchema,
        uiSchema: newUISchema,
        formData: newFormData
    };
}

function getConditionRules (condition = '') {
    let rules = [];
    let allHaveToMatch = false;
    let visible = false;

    // foo=bar || bar=foo
    if (condition.indexOf('||') !== -1) {
        rules = condition.split('||');
        allHaveToMatch = false;
        visible = false;
    }
    // foo=bar && bar=foo
    else if (condition.indexOf('&&') !== -1) {
        rules = condition.split('&&');
        allHaveToMatch = true;
        visible = true;
    }
    // foo=bar
    else {
        rules = [condition];
        allHaveToMatch = true;
        visible = true;
    }

    return {
        rules,
        allHaveToMatch,
        visible
    };
}

function getConditionRule (conditionRule) {
    let rule = []
    let invert;

    // foo!=bar
    if (conditionRule.indexOf('!=') !== -1) {
        rule = conditionRule.split('!=');
        invert = true;
    }
    // foo=bar
    else if (conditionRule.indexOf('=') !== -1) {
        rule = conditionRule.split('=');
        invert = false;
    }

    if (rule.length !== 2) {
        return false;
    }

    let [field, values] = rule;

    values = values.split(',');

    return {
        field,
        values,
        invert
    };
}

function handleFieldChange(inputSchema, uiSchema, formData){
	promises = [];
  const newState = processForm(originalSchema, originalUISchema, inputSchema, uiSchema, formData);
  console.log(formData)
  return enrichForm(_.cloneDeep(newState.schema), _.cloneDeep(newState.uiSchema), _.cloneDeep(newState.formData));
}

function getInitialJsonSchemaData(inputSchema, uiSchema, formData){
	promises = [];
  const newState = processForm(originalSchema, originalUISchema, inputSchema, uiSchema, formData);
  return enrichForm(_.cloneDeep(newState.schema), _.cloneDeep(newState.uiSchema), _.cloneDeep(newState.formData));
}

function setEnums(field, data) {
	if (data.items && data.items.length){
  	field['enum'] = [];
    field['enumNames'] = [];
    data.items.map(item => {
      field['enum'].push(item[field['serverValueKeyName']]);
      field['enumNames'].push(item[field['serverValueLabelName']]);
    })
  }
}

/*function enrichForm(schema, uiSchema, formData){
  debugger;
	Object.keys(schema.properties).forEach((fieldName) => {
  	let field = schema.properties[fieldName];
    if (field.type === 'object' && field.properties) {
    	enrichForm(field, uiSchema, formData);
    }
		if (field && field.dataSourceUrl) {
    	promises.push(
        fetch(field.dataSourceUrl).then(response => {
          return response.json();
        }).then(data => {
          setEnums(field, data);
        }));
    }
  });
  const promiseToReturn = new Promise((resolve, reject) => {
  	if (promises.length) {
    	Promise.all(promises).then(()=>{
      	resolve({schema, uiSchema, formData});
      })
    } else {
      resolve({schema, uiSchema, formData});
    }
  })
  return promiseToReturn;
}*/

function fetchData(field, promises) {
  promises.push(
    fetch(field.dataSourceUrl).then(response => {
      return response.json();
    }).then(data => {
      setEnums(field, data);
    }));
}

function enrichForm(schema, uiSchema, formData){
  debugger;
  if (schema.type === 'object' && schema.properties) {
    Object.keys(schema.properties).forEach((fieldName) => {
      let field = schema.properties[fieldName];
      if ((field.type === 'object' && field.properties) || (field.type === 'array' && field.items)) {
        enrichForm(field, uiSchema, formData);
      }
      if (field && field.dataSourceUrl) {
        fetchData(field, promises);
      }
    });
  } else if(schema.type === 'array'){
      if (!Array.isArray(schema.items)) {
         if ((schema.items.type === 'object' && schema.items.properties) || (schema.items.type === 'array' && schema.items.items)) {
              enrichForm(schema.items, uiSchema, formData);
            } else if (schema.items && schema.items.dataSourceUrl) {
              fetchData(schema.items, promises);
          }
      } else if (Array.isArray(schema.items)){
        schema.items.forEach((field) => {
            if ((field.type === 'object' && field.properties) || (field.type === 'array' && field.items)) {
                enrichForm(field, uiSchema, formData);
              }
          if (field && field.dataSourceUrl) {
            fetchData(field, promises);
          }
        })
      }
    
  } else if (schema && schema.dataSourceUrl){
    fetchData(field, promises);
  }
  
  const promiseToReturn = new Promise((resolve, reject) => {
    if (promises.length) {
      Promise.all(promises).then(()=>{
        resolve({schema, uiSchema, formData});
      })
    } else {
      resolve({schema, uiSchema, formData});
    }
  })
  return promiseToReturn;
}

/*
JSON


{
  "registrations": {
    "items": [
      {
        "registrationId": 11,
        "registrationName": "Reg11"
      },
      {
        "registrationId": 12,
        "registrationName": "Reg12"
      },
      {
        "registrationId": 13,
        "registrationName": "Reg13"
      }
    ]
  },
  "programs": {
    "items": [
      {
        "programId": 111,
        "programName": "Prog111"
      },
      {
        "programId": 222,
        "programName": "Prog222"
      },
      {
        "programId": 123,
        "programName": "IDA-123"
      }
    ]
  },
  "strategies": {
    "items": [
      {
        "strategyId": 31,
        "strategyName": "Strate-31"
      },
      {
        "strategyId": 32,
        "strategyName": "Strate-32"
      },
      {
        "strategyId": 33,
        "strategyName": "Strate-33"
      }
    ]
  }
}
*/