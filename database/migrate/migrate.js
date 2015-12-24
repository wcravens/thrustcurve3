/*
 * Copyright 2015 John Coker for ThrustCurve.org
 * Licensed under the ISC License, https://opensource.org/licenses/ISC
 */
'use strict';

var process = require('process'),
    async = require('async'),
    mysql = require('mysql'),
    mongoose = require('mongoose'),
    schema = require('../schema');

module.exports = {};

// https://docs.mongodb.org/v3.0/reference/object-id/
var nowHex = Math.floor((new Date().getTime() / 1000)).toString(16);
while (nowHex.length < 8)
  nowHex = '0' + nowHex;

function toObjectId(table, id) {
  var h, r, i;

  if (id == null)
    return;

  // 3-byte machine identifier
  h = 0;
  for (i = 0; i < table.length; i++)
    h += table.charCodeAt(i);
  h = h.toString(16);
  if (h.length > 6)
    h = h.substring(h.length - 6, h.length);
  while (h.length < 6)
    h = '0' + h;

  // 3-byte counter
  r = id.toString(16);
  while (r.length < 6)
    r = '0' + r;

  return mongoose.Types.ObjectId(nowHex + h + '0000' + r);
}

function mapUnit(value) {
  if (value === 10)
    return 'mm';
  if (value === 11)
    return 'cm';
  if (value === 12)
    return 'in';

  if (value === 30)
    return 'm';
  if (value === 31)
    return 'ft';

  if (value === 20)
    return 'kg';
  if (value === 21)
    return 'lb';
  if (value === 22)
    return 'oz';

  if (value === 40)
    return 'N';
  if (value === 41)
    return 'lbf';
}

function mapMMGStoMKS(value) {
  if (typeof value == 'number' && !isNaN(value))
    return value / 1000;
}

function mapWebsite(value) {
  if (!value || value == '-' || value == '--' || value.toLowerCase() == 'na')
    return;
  if (value && !/^https?:\/\//.test(value))
    value = 'http://' + value;

  if (schema.UrlRegex.test(value))
    return value;
}

var tables = [
  {
    name: 'manufacturer',
    model: schema.Manufacturer,
    columns: [
      {
        name: /^alias[1-6]$/,
        field: 'aliases',
        mapper: function() {
          var all = [],
              i;

          for (i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] == 'string' && arguments[i] !== '')
              all.push(arguments[i]);
          }
          if (all.length > 0)
            return all;
        }
      }
    ]
  },
  {
    name: 'cert_org',
    model: schema.CertOrg,
    columns: [
      {
        name: 'org_name',
        field: 'name'
      },
      {
        name: 'org_abbrev',
        field: 'abbrev'
      },
      {
        name: 'test_name',
        field: false
      },
      {
        name: 'test_abbrev',
        field: false
      }
    ]
  },
  {
    name: 'motor',
    model: schema.Motor,
    columns: [
      {
        name: 'mfr_desig',
        field: 'designation'
      },
      {
        name: 'alt_desig',
        field: 'altDesignation'
      },
      {
        name: 'master_name',
        field: false
      },
      {
        name: 'brand_name',
        field: false
      },
      {
        name: 'cert_end',
        field: false
      },
      {
        name: 'common_name',
        field: 'commonName',
        mapper: function(n) {
          if (n == 'Micro Maxx')
            return '1/8A0.3';
          else
            return n;
        }
      },
      {
        name: 'cert_desig',
        field: 'certDesignation'
      },
      {
        name: 'diameter',
        field: 'diameter',
        mapping: mapMMGStoMKS
      },
      {
        name: 'length',
        field: 'length',
        mapping: mapMMGStoMKS
      },
      {
        name: 'tot_imp',
        field: 'totalImpulse'
      },
      {
        name: 'total_wgt',
        field: 'totalWeight',
        mapping: mapMMGStoMKS
      },
      {
        name: 'prop_wgt',
        field: 'propellantWeight',
        mapping: mapMMGStoMKS
      },
      {
        name: 'prop_info',
        field: 'propellantInfo'
      },
      {
        name: 'data_sheet_url',
        field: 'dataSheet'
      },
    ]
  },
  {
    name: 'contributor',
    model: schema.Contributor,
    filter: "exists(select * from simfile where contributor_id = id) or exists(select * from rocket where contributor_id = id)",
    columns: [
      {
        name: 'rep_mfr_id',
        field: '_representsMfr'
      },
      {
        name: 'website',
        field: 'website',
        mapper: mapWebsite
      },
      {
        name: 'pref_dimen_u',
        field: 'preferences.lengthUnit',
        mapper: mapUnit
      },
      {
        name: 'org',
        field: 'organization',
        mapper: mapUnit
      },
      {
        name: 'pref_alt_u',
        field: 'preferences.altitudeUnit',
        mapper: mapUnit
      },
      {
        name: 'pref_weight_u',
        field: 'preferences.massUnit',
        mapper: mapUnit
      },
      {
        name: 'pref_force_u',
        field: 'preferences.forceUnit',
        mapper: mapUnit
      },
      {
        name: 'perm_motors',
        field: 'permissions.editMotors',
      },
      {
        name: 'perm_simfiles',
        field: 'permissions.editSimFiles',
      },
      {
        name: 'perm_notes',
        field: 'permissions.editNotes',
      },
      {
        name: 'perm_contrib',
        field: 'permissions.editContributors',
      },
      {
        name: 'perm_rockets',
        field: 'permissions.editRockets',
      },
    ]
  },
  {
    name: 'motor_note',
    model: schema.MotorNote,
  },
  {
    name: 'simfile',
    filter: "format in ('RASP', 'RockSim')",
    model: schema.SimFile,
    columns: [
      {
        name: 'sim_data',
        field: 'data'
      },
    ]
  },
  {
    name: 'simfile_note',
    model: schema.SimFileNote,
    columns: [
      {
        name: 'simfile_id',
        field: '_simFile'
      },
    ]
  },
  {
    name: 'rocket',
    model: schema.Rocket,
    columns: [
      {
        name: 'body_diam_u',
        field: 'bodyDiameterUnit',
        mapper: mapUnit
      },
      {
        name: 'body_diam',
        field: 'bodyDiameter',
      },
      {
        name: 'weight_u',
        field: 'weightUnit',
        mapper: mapUnit
      },
      {
        name: 'mmt_diam',
        field: 'mmtDiameter',
      },
      {
        name: 'mmt_diam_u',
        field: 'mmtDiameterUnit',
        mapper: mapUnit
      },
      {
        name: 'mmt_len',
        field: 'mmtLength',
      },
      {
        name: 'mmt_len_u',
        field: 'mmtLengthUnit',
        mapper: mapUnit
      },
      {
        name: 'guide_len',
        field: 'guideLength',
      },
      {
        name: 'guide_len_u',
        field: 'guideLengthUnit',
        mapper: mapUnit
      },
      {
        name: 'cd',
        field: 'cd',
        mapper: function(value) {
          if (value == null || typeof value != 'number')
            return;
          if (value < 0.1)
            value = 0.1;
        }
      },
      {
        name: 'website',
        field: 'website',
        mapper: mapWebsite
      },
    ]
  },
];

var tableCount = 0,
    successCount = 0;

function migrateTable(table, rows, fields) {
  var mappings = [], migrated = [],
      column, mapping, output, found, inputs,
      r, v, m, i, j;

  console.log('* starting ' + table.name + '...');
  tableCount++;

  // get the set of column mappings
  for (i = 0; i < fields.length; i++) {
    column = fields[i].name;

    // find appropriate mapping (optional)
    mapping = undefined;
    if (table.columns) {
      for (j = 0; j < table.columns.length; j++) {
        m = table.columns[j];
        if ((m.name instanceof RegExp && m.name.test(column)) || m.name === column) {
          if (mapping != null) {
            console.error('! column "' + table.name + '.' + column + '" matches multiple mappers');
            return false;
          }
          mapping = m;
        }
      }
    }
    if (mapping && mapping.field === false)
      continue;

    // create a mapping if necessary
    if (mapping == null) {
      mapping = {
        name: column,
        field: column.replace(/_([a-z])/g, function(l) { return l.toUpperCase(); }).replace(/_/g, '')
      };
      if (mapping.field == 'id')
        mapping.field = '_id';
      else if (/Id$/.test(mapping.field))
        mapping.field = '_' + mapping.field.replace(/Id$/, '');
    }

    // make sure the target field exists
    if (!table.model.schema.paths.hasOwnProperty(mapping.field)) {
        console.error('! column "' + table.name + '.' + column + '" maps to invalid schema field ' + mapping.field);
        return false;
    }

    // handle duplicate column mappings
    if (mapping.name instanceof RegExp) {
      found = undefined;
      for (j = 0; j < mappings.length; j++) {
        if (mappings[j].mapping == mapping) {
          found = mappings[j];
          break;
        }
      }
      if (found) {
        if (typeof found.mapper != 'function') {
          console.error('! multiple columns, but ' + mapping.field + ' has no mapper function');
          return false;
        }
        found.inputs.push(column);
        continue;
      }
    }

    // build the new mapping
    mappings.push({
      mapping: mapping,
      inputs: [column],
      output: mapping.field,
      mapper: mapping.mapper
    });
  }

  // migrate each row
  for (r = 0; r < rows.length; r++) {
    // save the original ID
    output = {
      migratedId: rows[r].id
    };

    // map input columns
    for (i = 0; i < mappings.length; i++) {
      m = mappings[i];

      // collect non-null column value(s)
      inputs = [];
      for (j = 0; j < m.inputs.length; j++) {
        column = m.inputs[j];
        if (rows[r].hasOwnProperty(column)) {
          v = rows[r][column];
          if (typeof v == 'string')
            v = v.trim();
          if (v != null && v !== '')
            inputs.push(v);
        }
      }
      if (inputs.length < 1)
        continue;

      // extract the values
      if (m.mapper) {
         // apply custom mapper function
        v = m.mapper.apply(null, inputs);
      } else {
        // just use column value
        if (inputs.length > 1) {
          console.error('! multiple values, but ' + m.mapping.field + ' has no mapper function');
          return false;
        }
        v = inputs[0];
      }
      if (v == null)
        continue;

      // perform any necessary coercion
      if (table.model.schema.paths[m.output].instance == 'ObjectID') {
        if (!(v instanceof mongoose.Types.ObjectId))
          v = toObjectId(table.name, v);
      }

      output[m.output] = v;
    }
    migrated.push(table.model(output));
  }
  if (migrated.length != rows.length) {
    console.error('! ' + table.name + ' has ' + rows.length + ' rows, but ' + migrated.length + ' were migrated');
    return false;
  }

  // save the documents
  console.log('* creating ' + migrated.length + ' ' + table.model.modelName + ' documents...');
  table.model.create(migrated, function(err, results) {
    console.log('created');
    if (err) {
      var fields;
      if (err.errors && (fields = Object.keys(err.errors)).length > 0) {
        for (var i = 0; i < fields.length; i++)
          console.error('! save ' + fields[i] + ': ' + err.errors[fields[i]].message);
      } else {
        console.error('! ' + err.message || err);
      }
      console.log('* failed ' + table.name);
      return;
    }
    console.log('* finished ' + table.name + ': saved ' + results.length + ' documents.');
    successCount++;
  });

  return true;
}

mongoose.connect('mongodb://localhost/thrustcurve', function(err) {
  if (err) {
    console.error('! unable to connect to MongoDB');
    process.exit(1);
  }
});

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : process.env.USER,
  database : 'thrustcurve'
});
connection.connect();

var queries = [];
tables.forEach(function(table) {
  queries.push(function(cb) {
    var select = 'select * from ' + table.name;
    if (table.filter)
      select += ' where ' + table.filter;
    connection.query(select, function(err, rows, fields) {
      if (err)
        console.error('! error querying ' + table.name + ': ' + err.stack);
      else if (rows.length < 1)
        console.error('! no rows in table ' + table.name + '!');
      else
        migrateTable(table, rows, fields);
      cb(err, null);
    });
  });
});
async.series(queries, function(err, result) {
  if (err) {
    console.error('! ' + err.message || err);
  } else {
    console.log('* all finished');
  }
  mongoose.disconnect();
  connection.end();
});