const fetch = require('node-fetch');
const util = require('util');
const { URLSearchParams } = require('url');
const dateFns = require('date-fns');
const parseXML = util.promisify(require('xml2js').parseString);
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLInt,
  GraphQLFloat
} = require('graphql');

const { useRedis, redisSetKey } = require('./redisClient');

const Stopwatch = require('statman-stopwatch');
const sw = new Stopwatch();

const MagType = new GraphQLObjectType({
  name: 'Magnitude',
  description: 'Magnitudo',

  fields: () => ({
    value: { type: GraphQLFloat },
    uncertainty: { type: GraphQLFloat }
  })
});

const QuakeType = new GraphQLObjectType({
  name: 'Quake',
  description: 'Evento sismico',

  fields: () => ({
    description: {
      type: GraphQLString
    },
    origin: {
      type: OriginType
    },
    creationInfo: {
      type: CreationInfo
    },
    magnitude: {
      type: MagType
    }
  })
});

const OriginType = new GraphQLObjectType({
  name: 'Origin',
  description: "Origine dell'evento sismico",

  fields: () => ({
    latitude: {
      type: GraphQLFloat
    },
    longitude: {
      type: GraphQLFloat
    },
    time: { type: GraphQLString },
    uncertainty: { type: GraphQLFloat },
    depth: { type: DepthType }
  })
});

const DepthType = new GraphQLObjectType({
  name: 'Depth',
  description: "Profondità dell'evento sismico",

  fields: () => ({
    value: {
      type: GraphQLFloat
    },
    uncertainty: {
      type: GraphQLFloat
    }
  })
});

const CreationInfo = new GraphQLObjectType({
  name: 'CreationInfo',
  description: 'Chi ha creato il dato',

  fields: () => ({
    agencyID: {
      type: GraphQLString
    },
    author: {
      type: GraphQLString
    },
    creationTime: {
      type: GraphQLString
    }
  })
});

function getSafe(fn, defaultVal) {
  try {
    return fn();
  } catch (e) {
    return defaultVal;
  }
}

const QuakesType = new GraphQLObjectType({
  name: 'Quakes',
  description: 'Una lista di eventi sismici',

  fields: () => ({
    quakes: {
      type: new GraphQLList(QuakeType),
      resolve: xml => {
        sw.stop();
        console.log('Time elapsed: ', sw.read() + 'ms');
        return xml['q:quakeml']['eventParameters'][0].event.map(event => {
          return {
            description: event.description[0].text[0],
            magnitude: {
              value: getSafe(() => event.magnitude[0].mag[0].value[0]),
              uncertainty: getSafe(
                () => event.magnitude[0].mag[0].uncertainty[0]
              )
            },
            origin: {
              latitude: getSafe(() => event.origin[0].latitude[0].value[0]),
              longitude: getSafe(() => event.origin[0].longitude[0].value[0]),
              time: getSafe(() => event.origin[0].time[0].value[0]),
              uncertainty: getSafe(
                () => event.origin[0].time[0].uncertainty[0]
              ),
              depth: {
                value: getSafe(() => event.origin[0].depth[0].value),
                uncertainty: getSafe(() => event.origin[0].depth[0].uncertainty)
              }
            },
            creationInfo: {
              agencyID: getSafe(() => event.creationInfo[0].agencyID[0]),
              author: getSafe(() => event.creationInfo[0].author[0]),
              creationTime: getSafe(() => event.creationInfo[0].creationTime[0])
            }
          };
        });
      }
    }
  })
});

const ingvWebService = (() => {
  const endpoint = `http://webservices.ingv.it/fdsnws/event/1/query`;
  return {
    getEvents: params => {
      return fetch(endpoint + '?' + params.toString())
        .then(response => response.text())
        .then(parseXML);
    }
  };
})();

module.exports = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    description:
      'Ritorna tutti gli eventi sismici riportati in un certo periodo',

    fields: () => {
      const prevDate = new Date();
      prevDate.setMonth(prevDate.getMonth() - 1);

      return {
        events: {
          type: QuakesType,
          args: {
            starttime: {
              type: GraphQLString,
              defaultValue: dateFns.format(prevDate, 'YYYY-MM-DDTHH:mm:ss')
            },
            endtime: {
              type: GraphQLString,
              defaultValue: dateFns.format(new Date(), 'YYYY-MM-DDTHH:mm:ss')
            },
            maxmag: { type: GraphQLFloat },
            minmag: { type: GraphQLFloat },
            maxdepth: { type: GraphQLFloat },
            minlat: { type: GraphQLFloat },
            maxlat: { type: GraphQLFloat },
            minlon: { type: GraphQLFloat },
            maxlon: { type: GraphQLFloat },
            minversion: { type: GraphQLFloat },
            format: { type: GraphQLString },
            limit: { type: GraphQLInt, defaultValue: 50 }
          },
          resolve: (root, args) => {
            sw.start(); // Resolve is started!
            const params = new URLSearchParams();
            Object.keys(args).map(arg =>
              args[arg] ? params.append(arg, args[arg]) : null
            );

            if (args.starttime && args.endtime) {
              const key = args.starttime + '' + args.endtime;
              return useRedis(key, () =>
                ingvWebService
                  .getEvents(params.toString())
                  .then(redisSetKey(key))
              );
            }
            return ingvWebService.getEvents(params.toString(), false);
          }
        }
      };
    }
  })
});
