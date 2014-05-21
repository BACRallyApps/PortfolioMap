var Ext = window.Ext4 || window.Ext;

var mapInitiativeRef = function mapInitiatives(feature) {
  return Rally.util.Ref.getRefObject(feature.raw.Parent);
};

var mapRefObjToShortRef = function mapRefObjToShortRef(ref) {
  return ref.getRelativeUri();
};

var mapRefObjToOid = function mapRefObjToOid(ref) {
  return ref.getOid();
};

var oidFromRef = function (ref) {
  return Rally.util.Ref.getOidFromRef(ref);
};

var parentRef = function (a) {
  return (a.raw.Parent ? a.raw.Parent._ref : '/0');
};

var projectRef = function (a) {
  return Rally.util.Ref.getRefObject(a.raw.Project).getRelativeUri();
};

Ext.define('CustomApp', {
  extend: 'Rally.app.App',
  mixins: {
    observable: 'Ext.util.Observable',
    maskable: 'Rally.ui.mask.Maskable'
  },

  componentCls: 'app',
  settingsScope: 'workspace',
  autoScroll: true,

  config: {
    defaultSettings: {
      featureCardsPerColumn: 5
    }
  },

  features: null,
  initiatives: null,
  releases: null,
  selectedReleases: null,

  layout: {
    type: 'vbox'
  },

  constructor: function (config) {
    var me = this;

    this.callParent([config]);
    this.mixins.observable.constructor.call(this, config);

    this.addEvents('load');

    this.fidTemplate = Rally.nav.DetailLink;
    this.cardTemplate = new Ext.XTemplate(
      '<tpl if="color != null">',
        '<div class="card {type} state-{state} oid-{oid}" style=\'border-top: solid 8px {color}\'>',
      '<tpl else>',
        '<div class="card {type}">',
      '</tpl>',
      '<p class="name">{fidLink} {name}</p>',
      '<tpl if="size"><p class="size">{size}</p></tpl>',
      '</div>'
    );
    this.headerTemplate = new Ext.XTemplate(
      '<div class="header" style="width: {width}">',
        '<div class="name"><h1>{name}</h1></div>',
        '<div class="info">',
          '{accepted} of {total} Story Points are done. ',
          '{[ values.completed - values.accepted ]} Story Points are awaiting approval. ',
          '{[ values.total - values.accepted ]} Story Points remaining. ',
          '<tpl if="notEstimated"><span style="color: red">{notEstimated} Stories are not estimated.</span></tpl>',
        '</div>',
      '</div>'
    );
  },

  getSettingsFields: function () {
    var fields = [{
      name: 'storyCardsPerColumn',
      label: 'Story Cards per Column',
      xtype: 'rallynumberfield'
    }];

    return fields;
  },

  getOptions: function () {
    return [{
      text: 'Choose Releases',
      handler: this.chooseReleases,
      scope: this
    }, {
      text: 'Show Color Legend',
      handler: this.showLegend,
      scope: this
    }];
  },

  chooseReleases: function () {
    var me = this;

    if (this.releaseChooserDlg) {
      this.releaseChooserDlg.show();
      return;
    }

    var ctx = me.getContext().getDataContext();
    var selectedReleases = {};

    this.releaseChooserDlg = Ext.create('Rally.ui.dialog.Dialog', {
      title: 'Select Releases',
      itemId: 'dialog',
      draggable: true,
      width: 800,
      closable: true,
      closeAction: 'hide',
      items: [{
        xtype: 'rallygrid',
        model: 'Release',
        itemId: 'releasechoosergrid',
        storeConfig: {
          context: _.merge(ctx, { projectScopeUp: false, projectScopeDown: false })
        },
        columnCfgs: ['Name', 'ReleaseStartDate', 'ReleaseDate'],
        selModel: Ext.create('Rally.ui.selection.CheckboxModel', {
          mode: 'MULTI',
          listeners: {
            select: function (t, record, index, eOpts) {
              selectedReleases[record.get('Name')] = record;
            },
            deselect: function (t, record, index, eOpts) {
              delete selectedReleases[record.get('Name')];
            }
          }
        }),
        listeners: {
          load: function (t) {
            var sr = me.selectedReleases || {};
            me.releaseChooserDlg.down('#releasechoosergrid').getSelectionModel().select(_.values(sr), false, true);
          }
        }
      }],
      bbar: [{
        xtype: 'rallybutton',
        text: 'Cancel',
        handler: function (source, evt) {
          source.up('#dialog').hide();
        }
      }, {
        xtype: 'rallybutton',
        text: 'Save',
        handler: function (source, evt) {
          console.log('selected releases changes', selectedReleases);
          me.fireEvent('selectedreleaseschanged', selectedReleases);
          source.up('#dialog').hide();
        }
      }],
      listeners: {
        hide: function () {
        }
      }
    });

    this.releaseChooserDlg.show();
  },

  _buildLegendEntry: function (label, color) {
    return {
      xtype: 'container',
      layout: {
        type: 'hbox'
      },
      style: {
        margin: '5px'
      },
      items: [{
        xtype: 'box',
        width: 16,
        height: 16,
        style: {
          border: color ? 'solid 1px black' : '',
          backgroundColor: color,
          marginRight: '5px'
        },
        html: '&nbsp'
      }, {
        xtype: 'box',
        height: 16,
        style: {
          verticalAlign: 'middle',
          display: 'table-cell',
          paddingTop: '2px'
        },
        html: ' ' + label
      }]
    };
  },

  showLegend: function () {
    var dlgWidth = 200;
    var me = this;

    if (!this.legendDlg) {
      var legend = [];

      _.forOwn({ 'Not Scheduled': 'grey', 'Scheduled in Future Iteration': 'yellow', 'Scheduled in Current Iteration': 'green', 'Not Accepted in Past Iteration': 'red' }, function (color, label) {
        legend.push(me._buildLegendEntry(label, color));
      });

      this.legendDlg = Ext.create('Rally.ui.dialog.Dialog', {
        autoShow: true,
        draggable: true,
        width: dlgWidth,
        height: 4 * 27,
        title: 'Story Color Legend',
        closable: true,
        closeAction: 'hide',
        modal: false,
        x: Ext.fly(this.getEl()).getWidth() - dlgWidth - 50,
        y: 20,
        items: legend
      });
    } else {
      this.legendDlg.show();
    }
  },

  addToContainer: function (con) {
    this.add(con);
  },

  createView: function (cols) {
    this.table = Ext.create('Ext.Container', {
      layout: {
        type: 'table',
        columns: cols + 1
      }
    });
  },

  addToView: function (com) {
    this.table.add(com);
  },

  launch: function launch() {
    var me = this;

    me.ctx = me.getContext().getDataContext();

    //me.ctx = {
      //workspace: '/workspace/711640',
      //project: '/project/4878215'
    //};

    //me.chooseReleases();

    me.subscribe(me, Rally.Message.objectUpdate, me._onObjectUpdated, me);
    me.on('selectedreleaseschanged', function (selectedReleases) {
      console.log('fire!', arguments);
      me.selectedReleases = selectedReleases;
      me.preInit();
    });

    console.log('ctx', me.ctx);
    Ext.create('Rally.data.wsapi.Store', {
      autoLoad: true,
      remoteFilter: false,
      model: 'TypeDefinition',
      context: me.ctx,
      sorters: [{
        property: 'Ordinal',
        direction: 'Desc'
      }],
      filters: [{
        property: 'Parent.Name',
        operator: '=',
        value: 'Portfolio Item'
      }, {
        property: 'Creatable',
        operator: '=',
        value: 'true'
      }],
      listeners: {
        load: function (store, recs) {
          me.piTypes = [];

          _.each(recs, function (type) {
            me.piTypes[parseInt(type.get('Ordinal') + '', 10)] = type;
          });

          me.preInit();
        },
        scope: me
      }
    });
  },

  preInit: function () {
    var me = this;

    me.initiatives = null;
    me.features = null;
    me.stories = null;
    me.projects = null;

    me.removeAll(true);

    if (!me.selectedReleases || _.keys(me.selectedReleases).length === 0) {
      me.chooseReleases();
    } else {
      me.loadData();
    }
  },

  _getStartDate: function () {
    var rel = _(this.selectedReleases).sortBy(function (r) { return r.data.ReleaseStartDate; }).first();
    return Rally.util.DateTime.toIsoString(rel.data.ReleaseStartDate);
  },

  _getEndDate: function () {
    var rel = _(this.selectedReleases).sortBy(function (r) { return r.data.ReleaseDate; }).last();
    return Rally.util.DateTime.toIsoString(rel.data.ReleaseDate);
  },

  loadData: function () {
    var me = this;

    me.showMask("Loading...");

    var featureStore = Ext.create('Rally.data.wsapi.Store', {
      model: me.piTypes[0].get('TypePath'),
      fetch: ['ObjectID', 'FormattedID', 'Name', 'Value', 'Parent', 'Project', 'PreliminaryEstimate', 'DirectChildrenCount', 'LeafStoryPlanEstimateTotal', 'DisplayColor', 'Release'],
      context: me.ctx,
      filters: [{
        property: 'Release.ReleaseStartDate',
        operator: '>=',
        value: this._getStartDate()
      }, {
        property: 'Release.ReleaseDate',
        operator: '<=',
        value: this._getEndDate()
      }],
      sorters: [{
        property: 'Rank',
        direction: 'ASC'
      }]
    });

    //var initiativeStore = Ext.create('Rally.data.wsapi.Store', {
      //model: me.piTypes[1].get('TypePath'),
      //autoLoad: true,
      //fetch: ['ObjectID', 'FormattedID', 'Name', 'Value', 'Parent', 'Project', 'UserStories', 'Children', 'PreliminaryEstimate', 'DirectChildrenCount', 'LeafStoryPlanEstimateTotal', 'DisplayColor'],
      //sorters: [{
        //property: 'Rank',
        //direction: 'ASC'
      //}]
    //});

    var projectStore = Ext.create('Rally.data.wsapi.Store', {
      model: 'Project',
      context: me.ctx,
      fetch: true
    });

    var releaseStore = Ext.create('Rally.data.wsapi.Store', {
      model: 'Release',
      context: _.merge(me.ctx, { projectScopeUp: false, projectScopeDown: false }),
      fetch: ['Name', 'ReleaseStartDate', 'ReleaseDate'],
      filters: [{
        property: 'ReleaseStartDate',
        operator: '>=',
        value: this._getStartDate()
      }, {
        property: 'ReleaseDate',
        operator: '<=',
        value: this._getEndDate()
      }],
      sorters: [{
        property: 'ReleaseStartDate',
        direction: 'ASC'
      }]
    });

    var nullInitiative = Ext.create('Deft.promise.Deferred');
    Rally.data.ModelFactory.getModel({
      type: me.piTypes[1].get('TypePath'),
      context: me.ctx,
      success: function (model) {
        var blank = Ext.create(model, {
          ObjectID: 0,
          Name: '(No ' + me.piTypes[1].get('ElementName') + ')',
          DragAndDropRank: '0',
          _ref: '/0'
        });
        nullInitiative.resolve(blank);
      },
      failure: function (err) {
        nullInitiative.reject(err);
      }
    });

    Deft.promise.Promise.all([releaseStore.load(), projectStore.load(), featureStore.load(), nullInitiative.promise])
      .then(function (data) {
        var releases            = data[0],
            projects            = data[1],
            features            = data[2],
            nullInitiativeValue = data[3];

        me.processProjects(projects);
        me.processFeatures(features);
        me.processInitiatives(features, nullInitiativeValue);
        me.processReleases(releases);

        return me;
      }).then(function () {
        me._onLoad();
      }, function (err) {
        console.error(err);
      }).then(null, function (err) {
        console.error(err);
        setTimeout(function () { throw err; }, 1);
      });
  },

  processProjects: function (projects) {
    this.projectRecs = projects;
    this.projects    = _.indexBy(projects, function (project) { return project.get('_ref'); });
  },

  processFeatures: function (features) {
    var releases = _.keys(this.selectedReleases);
    features = _.filter(features, function (f) { return f.raw.Release && _.contains(releases, f.raw.Release._refObjectName); });
    this.featureRecs          = features;
    this.features             = _.indexBy(features, function (feature) { return feature.get('_ref'); });
    this.featuresByInitiative = _.groupBy(features, function (f) { return parentRef(f); });
  },

  processInitiatives: function (features, nullInitiative) {
    this.initiativeRecs = _(features)
      .filter(function (feature) { return feature.raw.Parent !== null; })
      .map(function (feature) { return feature.raw.Parent; })
      .unique(function (initiative) { return initiative._ref; })
      .value();
    this.initiatives    = _(this.initiativeRecs)
      .indexBy(function (initiative) { return initiative._ref; })
      .value();

    this.initiatives['/0'] = nullInitiative;
    this.initiativeRecs.push(nullInitiative);
  },

  processReleases: function (releases) {
    var me = this;
    releases = _.filter(releases, function (release) { return me.selectedReleases[release.get('Name')]; });

    this.releases = _(releases)
      .unique(function (release) { return release.get('Name'); })
      .groupBy(function (release) { return release.get('Name'); })
      .value();
    this.releaseRecs = releases;
    this.releaseNameByDate = _(releases)
      .unique(function (r) { return r.get('Name'); })
      .sortBy(function (r) { return r.get('ReleaseStartDate'); })
      .map(function (r) { return r.get('Name'); })
      .value();

    console.log('rels by date', this.releaseNameByDate);
  },

  _onLoad: function () {
    var me = this;

    me.hideMask();

    me.featuresByProject = _.groupBy(me.featureRecs, function (f) { return f.raw.Project._ref; });
    me.initiativesByProject = _.transform(me.featuresByProject, function (res, val, key) {
      res[key] = _(val)
        .map(function (f) { return parentRef(f); })
        .unique()
        .value();
    });
    me.featuresByRelease = _(me.featureRecs)
      .filter(function (f) { return !!(f.raw.Release); })
      .groupBy(function (f) { return f.raw.Release._refObjectName; })
      .value();

    me.suspendLayouts();

    me.addToContainer({
      xtype: 'box',
      layout: 'fit',
      html: me.headerTemplate.apply({
        width:        (Ext.get(me.getEl()).getWidth() - 10) + "px",
        name:         'Portfolio Map',
        accepted:     0,
        completed:    0,
        total:        0,
        notEstimated: 0
      })
    });

    me.createView(_.keys(me.releases).length);
    me.addToView({ xtype: 'box', html: '' });

    _.each(me.releaseNameByDate, function (n) {
      me.addToView({
        xtype: 'box',
        html: me.cardTemplate.apply({ type: 'release', name: n })
      });
    });

    _.each(_(me.projects).keys().sortBy(function (k) { return me.projects[k].raw.Name; }).value(), function (p) {
      if (_(me.features).filter(function (f) { return projectRef(f) === p; }).value().length) {
        me.addProject(p);
      }
    });
    me.resumeLayouts(true);
    me.add(me.table);
  },

  addProject: function (projectId) {
    var me = this;
    var cls = Ext.isIE ? 'rotate rotate-ie' : 'rotate';

    var container = Ext.create('Ext.container.Container', {
      layout: {
        type: 'hbox'
        //align: 'stretchmax'
      },
      items: [{
        xtype: 'box',
        cls: Ext.isIE ? 'rotate-parent' : 'rotate-parent',
        html: '<div class="' + cls + '">' + me.projects[projectId].get('Name') + '</div>'
      }]
    });

    me.addToView(container);

    _.each(me.releaseNameByDate, function (rn) {
      me.addInitiativesForRelease(projectId, rn);
    });

  },

  addInitiativesForRelease: function (projectId, releaseName) {
    var me = this;
    var container = Ext.create('Ext.container.Container', {
      layout: {
        type: 'hbox',
        align: 'stretchmax'
      }
    });

    _(me.featuresByRelease[releaseName])
      .filter(function (f) { return projectRef(f) === projectId; })
      .map(function (f) { return parentRef(f); })
      .unique()
      .each(function (i) {
        container.add(me.addInitiative(projectId, releaseName, i));
      });

    me.addToView(container);
  },

  addInitiative: function (projectId, releaseName, initiativeId) {
    var me = this;
    var data = {};
    var iid;
    var container, featureContainer, featureColumnContainer;
    var fcount;
    var fmax;

    if (!me.initiatives[initiativeId]) { return; }

    data.type    = 'initiative';
    data.name    = me.initiatives[initiativeId].Name || me.initiatives[initiativeId].get('Name');
    //data.fidLink = me.fidTemplate.getLink({
      //record: me.initiatives[initiativeId].data,
      //text: me.initiatives[initiativeId].get('FormattedID'), showHover: false
    //});

    container = Ext.create('Ext.container.Container', {
      layout: {
        type: 'vbox',
        align: 'stretch'
      },
      items: [{
        xtype: 'box',
        html: me.cardTemplate.apply(data)
      }]
    });

    featureContainer = Ext.create('Ext.container.Container', {
      layout: {
        type: 'vbox'
      }
    });

    container.add(featureContainer);

    //console.log('looking for features', initiativeId);
    _(me.featuresByRelease[releaseName])
      .filter(function (f) {
        var oid = parentRef(f);
        //console.log(typeof oid, typeof initiativeId, oid, initiativeId);
        return oid + '' === initiativeId;
      })
      .unique()
      .filter(function (f) { return projectRef(f) === projectId; })
      .each(function (f) {
        featureContainer.add(me.addFeature(projectId, initiativeId, f.get('_ref')));
      });

    return container;
  },

  addFeature: function (projectId, initiativeId, featureId) {
    //console.log('Add feature', projectId, initiativeId, featureId);
    var me      = this;
    var i       = 0;
    var data    = me._dataForFeature(me.features[featureId]);
    var storyContainer;
    var storyColumnContainer;

    //console.log('Feature', data);

    var container = Ext.create('Ext.container.Container', {
      layout: {
        type: 'vbox',
        align: 'stretch'
      },
      items: [{
        xtype: 'container',
        layout: 'table',
        oid: featureId,
        items: [{
          xtype: 'box',
          html: me.cardTemplate.apply(data)
        }],
        listeners: {
          afterrender: function (t) {
            var d = this;
            t.getEl().on('mousedown', function (e) {
              e.preventDefault();
            });

            t.getEl().on('dblclick', function(e) {
              e.preventDefault();
              Rally.nav.Manager.edit(d._ref);
              return false;
            });
          },
          scope: (function (d) { return d; }(data))
        }
      }]
    });

    return container;
  },

  _dataForFeature: function (record) {
    var me = this;
    var data = {};

    data.type        = 'feature';
    data.oid         = record.get('ObjectID');
    data._ref        = record.get('_ref');
    data.name        = record.get('Name');
    data.size        = '';
    data.storySize   = record.get('LeafStoryPlanEstimateTotal') || 0;
    data.featureSize = 0;
    if (record.get('PreliminaryEstimate')) {
      data.featureSize = record.get('PreliminaryEstimate').Value;
    }
    if (data.featureSize) {
      data.size = data.featureSize + ' FP';
    }
    if (data.featureSize && data.storySize) {
      data.size = data.size + ' / ';
    }
    if (data.storySize) {
      data.size = data.size + data.storySize + ' SP';
    }
    data.color   = record.raw.DisplayColor ? record.raw.DisplayColor || 'black' : 'black';
    data.fidLink = me.fidTemplate.getLink({record: record.data, text: record.get('FormattedID'), showHover: false});

    return data;
  },

  _refreshCard: function (record, dataFn) {
    var me = this;
    var cards = this.query('component[oid=' +  record.get('ObjectID') + ']');
    var data = dataFn(record);

    //console.log(cards);
    _.each(cards, function (c) {
      c.removeAll();
      c.add({
        xtype: 'box',
        html: me.cardTemplate.apply(data)
      });
    });

  },

  _onObjectUpdated: function (record) {
    var me = this;
    var m = record.getProxy().getModel();
    var fetch, fetchS, fetchF;
    var dataFn;

    fetchF = ['ObjectID', 'FormattedID', 'Name', 'Value', 'Parent', 'Project', 'UserStories', 'Children', 'PreliminaryEstimate', 'DirectChildrenCount', 'LeafStoryPlanEstimateTotal', 'DisplayColor'];

    if (record.get('_type').toLowerCase().indexOf('portfolioitem') !== -1) {
      fetch = fetchF;
      dataFn = Ext.Function.bind(me._dataForFeature, me);
    }

    me.showMask('Updating...');
    m.load(record.get('ObjectID'), {
      fetch: fetch,
      callback: function (result) {
        me._refreshCard(result, dataFn);

        if (result.get('_type').toLowerCase() === 'hierarchicalrequirement') {
          Rally.data.ModelFactory.getModel({
            type: me.piTypes['0'].get('TypePath'),
            success: function (feature) {
              feature.load(result.get(me.piTypes['0'].get('ElementName')).ObjectID, {
                fetch: fetchF,
                callback: function (f) {
                  me._refreshCard(f, Ext.Function.bind(me._dataForFeature, me));
                  me.hideMask();
                }
              });
            }
          });
        } else {
          me.hideMask();
        }
      }
    });
  }
});
