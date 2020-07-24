var clusterArray = [];
var activeCluster;
var isExpand = false;
const apiURL = "http://localhost:9000/getdata";

var graphParams = {
  selector: "#svgChart",
  chartWidth: window.innerWidth - 40,
  chartHeight: 700,
  funcs: {
    setClusterActive: null,
    showCurrentItem: null,
    search: null,
    closeSearchBox: null,
    clearResult: null,
    findInTree: null,
    reflectResults: null,
    back: null,
    toggleFullScreen: null,
    locate: null,
    closeToolTip: null,
  },
  data: null,
  active: true,
  nodeWidth: 50,
  nodeHeight: 50,
};

d3.json(apiURL, function (data) {
  data.graph.forEach(function (data, index) {
    populateCluster(index, 0, data);
  });
  drawAllChart();
  // shiftText();
});

function drawAllChart() {
  clusterArray.forEach(function (cluster, index) {
    drawChart(cluster, index);
  });
}

function populateCluster(index, activeIndex, data) {
  var newGraphParams = JSON.parse(JSON.stringify(graphParams));

  newGraphParams.data = data;
  newGraphParams.pristinaData = newGraphParams;
  if (index != activeIndex) {
    newGraphParams.chartWidth = (window.innerWidth - 40) / 6 - 6;
    newGraphParams.chartHeight = newGraphParams.chartWidth;
    newGraphParams.selector = "#svgSubChart";
    newGraphParams.active = false;
    newGraphParams.nodeHeight = 30;
    newGraphParams.nodeWidth = 30;
  } else {
    newGraphParams.chartWidth = window.innerWidth - 40;
    newGraphParams.chartHeight = newGraphParams.chartHeight;
    newGraphParams.selector = "#svgChart";
    newGraphParams.active = true;
    newGraphParams.nodeHeight = 50;
    newGraphParams.nodeWidth = 50;
  }
  clusterArray.push(newGraphParams);
}

function drawChart(graphParams, index) {
  listen();

  graphParams.funcs.expandAll = expandAll;
  graphParams.funcs.setClusterActive = setClusterActive;
  graphParams.funcs.search = searchItems;
  graphParams.funcs.toggleFullScreen = toggleFullScreen;
  graphParams.funcs.closeSearchBox = closeSearchBox;
  graphParams.funcs.findInTree = findInTree;
  graphParams.funcs.clearResult = clearResult;
  graphParams.funcs.reflectResults = reflectResults;
  graphParams.funcs.closeToolTip = closeToolTip;
  // graphParams.funcs.showCurrentItem = showCurrentItem;
  // graphParams.funcs.back = back;
  graphParams.funcs.locate = locate;

  if (graphParams.active) {
    activeCluster = graphParams;
  }

  var attrs = {
    EXPAND_SYMBOL: "\uf067",
    COLLAPSE_SYMBOL: "\uf068",
    selector: graphParams.selector,
    root: graphParams.data,
    width: graphParams.chartWidth,
    height: graphParams.chartHeight,
    index: 0,
    nodePadding: graphParams.active ? 5 : 3,
    collapseCircleRadius: 7,
    nodeHeight: graphParams.nodeHeight,
    nodeWidth: graphParams.nodeWidth,
    duration: 750,
    rootNodeTopMargin: graphParams.active ? 20 : 12,
    minMaxZoomProportions: [0.05, 3],
    linkLineSize: 100,
    collapsibleFontSize: "10px",
    userIcon: "\uf007",
    nodeStroke: "#ccc",
    nodeStrokeWidth: "1px",
  };

  var dynamic = {};
  dynamic.nodeImageWidth = graphParams.active
    ? (attrs.nodeHeight * 100) / 140
    : (attrs.nodeHeight * 100) / 140;
  dynamic.nodeImageHeight = attrs.nodeHeight - 2 * attrs.nodePadding;
  dynamic.nodeTextLeftMargin = 0; //attrs.nodePadding * 2 + dynamic.nodeImageWidth;

  dynamic.rootNodeLeftMargin = attrs.width / 2;
  dynamic.nodePositionNameTopMargin =
    attrs.nodePadding + 8 + (dynamic.nodeImageHeight / 4) * 1;
  dynamic.nodeChildCountTopMargin =
    attrs.nodePadding + 14 + (dynamic.nodeImageHeight / 4) * 3;

  var tree = d3.layout
    .tree()
    .nodeSize([attrs.nodeWidth + 40, attrs.nodeHeight]);
  var diagonal = d3.svg.diagonal().projection(function (d) {
    return [d.x + attrs.nodeWidth / 2, d.y + attrs.nodeHeight / 2];
  });

  var zoomBehaviours = d3.behavior
    .zoom()
    .scaleExtent(attrs.minMaxZoomProportions)
    .on("zoom", function () {
      return graphParams.active ? redraw() : null;
    });

  var svg = d3
    .select(attrs.selector)
    .append("div")
    .attr("class", function () {
      if (graphParams.active) return "cluster active card";
      else return "cluster card";
    })
    .attr("id", "cluster" + (index + 1))
    .append("svg")
    .attr("width", attrs.width)
    .attr("height", attrs.height)
    .call(zoomBehaviours)
    .append("g")

    .attr("transform", function () {
      return (
        "translate(" +
        (attrs.width - attrs.nodeWidth) / 2 +
        "," +
        (attrs.nodeHeight + 5) +
        ")"
      );
    });

  if (!graphParams.active) {
    var viewicon = d3
      .select(attrs.selector + " #cluster" + (index + 1))
      .append("button")
      .attr("class", "btn btn-cluster-view")
      .attr("onclick", "activeCluster.funcs.setClusterActive(" + index + ")")
      .append("i")
      .attr("class", "fa fa-eye")
      .attr("aria-hidden", "true");
  }
  //necessary so that zoom knows where to zoom and unzoom from
  zoomBehaviours.translate([
    dynamic.rootNodeLeftMargin,
    attrs.rootNodeTopMargin,
  ]);

  attrs.root.x0 = 0;
  attrs.root.y0 = dynamic.rootNodeLeftMargin;

  // adding unique values to each node recursively
  var uniq = 1;
  addPropertyRecursive(
    "uniqueIdentifier",
    function (v) {
      return uniq++;
    },
    attrs.root
  );

  // expand(attrs.root);
  if (attrs.root.children) {
    attrs.root.children.forEach(collapse);
  }

  update(attrs.root);

  d3.select(attrs.selector).style("height", attrs.height);
  var tooltip;
  if (!$("div.customTooltip-wrapper").length) {
    tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "customTooltip-wrapper");
  } else {
    tooltip = d3.select("customTooltip-wrapper");
  }

  function update(source, param) {
    if (!source) return true;
    // Compute the new tree layout.
    var nodes = tree.nodes(attrs.root).reverse(),
      links = tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function (d) {
      d.y = d.depth * attrs.linkLineSize;
    });

    // Update the nodes…
    var node = svg.selectAll("g.node").data(nodes, function (d) {
      return d.id || (d.id = ++attrs.index);
    });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", function (d) {
        return "translate(" + source.x0 + "," + source.y0 + ")";
      });

    var nodeGroup = nodeEnter.append("g").attr("class", "node-group");

    nodeGroup
      .append("rect")
      .attr("width", attrs.nodeWidth)
      .attr("height", attrs.nodeHeight)
      .attr("data-node-group-id", function (d) {
        return d.uniqueIdentifier;
      })
      .attr("class", function (d) {
        var res = "";
        if (d.is_unknown) res += "nodeRepresentsCurrentItem ";
        res +=
          d._children || d.children
            ? "nodeHasChildren"
            : "nodeDoesNotHaveChildren";
        return res;
      });

    var collapsiblesWrapper = nodeEnter
      .append("g")
      .attr("data-id", function (v) {
        return v.uniqueIdentifier;
      });

    //hide collapse rect when node does not have children
    if (graphParams.active) {
      var collapsibles = collapsiblesWrapper
        .append("circle")
        .attr("class", "node-collapse")
        .attr("cx", attrs.nodeWidth - attrs.collapseCircleRadius)
        .attr("cy", attrs.nodeHeight - 7)
        .attr("", setCollapsibleSymbolProperty);

      collapsiblesWrapper
        .append("rect")
        .attr("class", "node-collapse-right-rect")
        .attr("height", attrs.collapseCircleRadius)
        .attr("fill", "black")
        .attr("x", attrs.nodeWidth - attrs.collapseCircleRadius)
        .attr("y", attrs.nodeHeight - 7)
        .attr("width", function (d) {
          if (d.children || d._children) return attrs.collapseCircleRadius;
          return 0;
        });
      collapsibles
        .attr("r", function (d) {
          if (d.children || d._children) return attrs.collapseCircleRadius;
          return 0;
        })
        .attr("height", attrs.collapseCircleRadius);

      nodeGroup
        .append("text")
        .attr("x", dynamic.nodeTextLeftMargin + 4)
        .attr("y", function () {
          return graphParams.active
            ? dynamic.nodeChildCountTopMargin - 2
            : dynamic.nodeChildCountTopMargin;
        })
        .attr("class", "children-count")
        .attr("text-anchor", "left")

        .text(function (d) {
          if (d.children) return d.children.length;
          if (d._children) return d._children.length;
          return;
        });

      collapsiblesWrapper
        .append("text")
        .attr("class", "text-collapse")
        .attr("x", attrs.nodeWidth - attrs.collapseCircleRadius)
        .attr("y", attrs.nodeHeight - 3)
        .attr("width", attrs.collapseCircleRadius)
        .attr("height", attrs.collapseCircleRadius)
        .style("font-size", attrs.collapsibleFontSize)
        .attr("text-anchor", "middle")
        .style("font-family", "FontAwesome")
        .text(function (d) {
          return d.collapseText;
        });
    }

    collapsiblesWrapper.on("click", click);

    nodeGroup
      .append("text")
      .attr("x", dynamic.nodeTextLeftMargin)
      .attr("y", -5)
      .attr("class", "item-name")
      .attr("text-anchor", "left")
      .text(function (d) {
        return d.name.trim();
      });
    //   .call(wrap, attrs.nodeWidth);

    nodeGroup
      .append("defs")
      .append("svg:clipPath")
      .attr("id", "clip")
      .append("svg:rect")
      .attr("id", "clip-rect")
      .attr("rx", 3)
      .attr("x", attrs.nodePadding + 2)
      .attr("y", attrs.nodePadding)
      .attr("width", dynamic.nodeImageWidth)
      .attr("fill", "none")
      .attr("height", dynamic.nodeImageHeight - 4);

    nodeGroup
      .append("svg:image")
      .attr("y", 2 + attrs.nodePadding)
      .attr("x", attrs.nodePadding + 2)
      .attr("preserveAspectRatio", "none")
      .attr("width", dynamic.nodeImageWidth)
      .attr("height", dynamic.nodeImageWidth)
      .attr("clip-path", "url(#clip)")
      .attr("xlink:href", function (v) {
        if (v.type == "machine") {
          var type = v.additional_data.os
            ? "-" + v.additional_data.os.toLowerCase()
            : "";
          type += v._children && v._children.length ? "-expand" : "";
          if (v.type == "machine" && !v.additional_data.has_access)
            type = "-noaccess";
          if (v.is_unknown) type += "-unknown";
          return getIcon(v.type, type);
        } else if (v.type == "application") {
          var type = "-all";
          return getIcon(v.type, type);
        } else if (v.type == "appstack") {
          var type = "-all";
          return getIcon(v.type, type);
        }
      });

    // Transition nodes to their new position.
    var nodeUpdate = node
      .transition()
      .duration(attrs.duration)
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

    //todo replace with attrs object
    nodeUpdate
      .select("rect")
      .attr("width", attrs.nodeWidth)
      .attr("height", attrs.nodeHeight)
      .attr("rx", 3)
      .attr("stroke", function (d) {
        if (param && d.uniqueIdentifier == param.locate) {
          return "#a1ceed";
        }
        return attrs.nodeStroke;
      })
      .attr("stroke-width", function (d) {
        if (param && d.uniqueIdentifier == param.locate) {
          return 6;
        }
        return attrs.nodeStrokeWidth;
      });

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node
      .exit()
      .transition()
      .duration(attrs.duration)
      .attr("transform", function (d) {
        return "translate(" + source.x + "," + source.y + ")";
      })
      .remove();

    nodeExit
      .select("rect")
      .attr("width", attrs.nodeWidth)
      .attr("height", attrs.nodeHeight);

    // Update the links…
    var link = svg.selectAll("path.link").data(links, function (d) {
      return d.target.id;
    });

    // Enter any new links at the parent's previous position.
    link
      .enter()
      .insert("path", "g")
      .attr("class", "link")
      .attr("x", attrs.nodeWidth / 2)
      .attr("y", attrs.nodeHeight / 2)
      .attr("d", function (d) {
        var o = {
          x: source.x0,
          y: source.y0,
        };
        return diagonal({
          source: o,
          target: o,
        });
      });

    // Transition links to their new position.
    link.transition().duration(attrs.duration).attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link
      .exit()
      .transition()
      .duration(attrs.duration)
      .attr("d", function (d) {
        var o = {
          x: source.x,
          y: source.y,
        };
        return diagonal({
          source: o,
          target: o,
        });
      })
      .remove();

    // Stash the old positions for transition.
    nodes.forEach(function (d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });

    if (param && param.locate) {
      var x;
      var y;

      nodes.forEach(function (d) {
        if (d.uniqueIdentifier == param.locate) {
          x = d.x;
          y = d.y;
        }
      });

      // normalize for width/height
      var new_x = -x + window.innerWidth / 2;
      var new_y = -y + window.innerHeight / 2;

      // move the main container g
      svg.attr("transform", "translate(" + new_x + "," + new_y + ")");
      zoomBehaviours.translate([new_x, new_y]);
      zoomBehaviours.scale(1);
    }

    if (param && param.centerMySelf) {
      var x;
      var y;

      nodes.forEach(function (d) {
        if (d.is_unknown) {
          x = d.x;
          y = d.y;
        }
      });

      // normalize for width/height
      var new_x = -x + window.innerWidth / 2;
      var new_y = -y + window.innerHeight / 2;

      // move the main container g
      svg.attr("transform", "translate(" + new_x + "," + new_y + ")");
      zoomBehaviours.translate([new_x, new_y]);
      zoomBehaviours.scale(1);
    }

    /*################  TOOLTIP  #############################*/

    function getTagsFromCommaSeparatedStrings(tags) {
      return tags
        .split(",")
        .map(function (v) {
          return '<li><div class="tag">' + v + "</div></li>  ";
        })
        .join("");
    }

    function tooltipContent(item) {
      var strVar = "";

      strVar += '  <div class="customTooltip">';
      strVar +=
        '<div class="tooltip close-button-wrapper"><i onclick="activeCluster.funcs.closeToolTip()" class="fa fa-times" aria-hidden="true"></i></div>';
      strVar += '    <div class="tooltip-desc">';
      if (item.type == "machine") {
        strVar +=
          '      <a class="name" href="/machine/' +
          item.id +
          '" target="_blank"> ' +
          item.name +
          "</a>";
      }
      strVar += '      <p class="title type">' + item.name + "</p>";
      strVar +=
        '      <h4 class="tags-wrapper"><span class="title">Machine List';
      strVar +=
        '        </span>           <ul class="tags">' +
        getTagsFromCommaSeparatedStrings(
          item.additional_data.machines.join(",")
        ) +
        "</ul>         </h4> </div>";
      strVar += '    <div class="bottom-tooltip-hr"></div>';
      strVar += "  </div>";
      strVar += "";

      return strVar;
    }

    function tooltipHoverHandler(d) {
      var content = tooltipContent(d);
      tooltip.html(content);

      tooltip
        .transition()
        .duration(200)
        .style("opacity", "1")
        .style("display", "block");
      d3.select(this).attr("cursor", "pointer").attr("stroke-width", 50);

      var y = d3.event.pageY;
      var x = d3.event.pageX;

      //restrict tooltip to fit in borders
      if (y < 300) {
        y = 300;
      }

      // if (y > attrs.height - 300) {
      //   y -= 300 - (attrs.height - y);
      // }

      tooltip.style("top", y - 300 + "px").style("left", x - 200 + "px");
    }

    function tooltipOutHandler() {
      tooltip
        .transition()
        .duration(200)
        .style("opacity", "0")
        .style("display", "none");
      d3.select(this).attr("stroke-width", 5);
    }
    // debugger;
    nodeGroup.on("click", tooltipHoverHandler);
    nodeGroup.on("dblclick", tooltipOutHandler);

    // function equalToEventTarget() {
    //   return this == d3.event.target;
    // }

    // d3.selectAll(":not.customTooltip").on("click", function () {
    //   var outside = tooltip.filter(equalToEventTarget).empty();
    //   if (outside) {
    //     tooltip.style("opacity", "0").style("display", "none");
    //   }
    // });
  }

  // Toggle children on click.
  function click(d) {
    d3.select(this)
      .select("text")
      .text(function (dv) {
        if (dv.collapseText == attrs.EXPAND_SYMBOL) {
          dv.collapseText = attrs.COLLAPSE_SYMBOL;
        } else {
          if (dv.children) {
            dv.collapseText = attrs.EXPAND_SYMBOL;
          }
        }
        return dv.collapseText;
      });

    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    update(d);
  }

  //########################################################

  //Redraw for zoom
  function redraw() {
    //console.log("here", d3.event.translate, d3.event.scale);
    svg.attr(
      "transform",
      "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")"
    );
  }

  // #############################   Function Area #######################

  function wrap(text, width) {
    text.each(function () {
      var text = d3.select(this),
        words = text.text().split(/\s+/).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        x = text.attr("x"),
        y = text.attr("y"),
        dy = 0, //parseFloat(text.attr("dy")),
        tspan = text
          .text(null)
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", dy + "em");
      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text
            .append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", ++lineNumber * lineHeight + dy + "em")
            .text(word);
        }
      }
    });
  }

  function addPropertyRecursive(propertyName, propertyValueFunction, element) {
    if (element[propertyName]) {
      element[propertyName] =
        element[propertyName] + " " + propertyValueFunction(element);
    } else {
      element[propertyName] = propertyValueFunction(element);
    }
    if (element.children) {
      element.children.forEach(function (v) {
        addPropertyRecursive(propertyName, propertyValueFunction, v);
      });
    }
    if (element._children) {
      element._children.forEach(function (v) {
        addPropertyRecursive(propertyName, propertyValueFunction, v);
      });
    }
  }

  function getItemsCount(node) {
    var count = 1;
    countChilds(node);
    return count;

    function countChilds(node) {
      var childs = node.children ? node.children : node._children;
      if (childs) {
        childs.forEach(function (v) {
          count++;
          countChilds(v);
        });
      }
    }
  }

  function reflectResults(results) {
    var htmlStringArray = results.map(function (result) {
      var strVar = "";
      strVar += '         <div class="list-item">';
      strVar += '            <div class="image-wrapper">';
      strVar +=
        '              <img class="image" src="' +
        getIcon(result.type, "-all") +
        '"/>';
      strVar += "            </div>";
      strVar += '            <div class="description">';
      strVar += '              <p class="name">' + result.name + "</p>";
      strVar += '              <p class="type">' + result.type + "</p>";
      strVar += "            </div>";
      strVar += '            <div class="buttons">';
      if (result.type != "machine") {
        strVar +=
          "              <a target='_blank' href='/machine/" +
          result.id +
          "'><button class='btn btn-search-box btn-action btn-view-machine'>View</button></a>";
      }

      strVar +=
        "              <button class='btn btn-search-box btn-action btn-locate' onclick='activeCluster.funcs.locate(" +
        result.uniqueIdentifier +
        ")'>Locate </button>";
      strVar += "            </div>";
      strVar += "        </div>";
      return strVar;
    });

    var htmlString = htmlStringArray.join("");
    graphParams.funcs.clearResult();

    var parentElement = get(".result-list");
    var old = parentElement.innerHTML;
    var newElement = htmlString + old;
    parentElement.innerHTML = newElement;
    set(
      ".user-search-box .result-header",
      "RESULT - " + htmlStringArray.length
    );
  }

  function clearResult() {
    set(".result-list", '<div class="buffer" ></div>');
    set(".user-search-box .result-header", "RESULT");
  }

  function listen() {
    var input = get(".user-search-box .search-input");
    if (input) {
      input.addEventListener("input", function () {
        var value = input.value ? input.value.trim() : "";
        if (value.length < 3) {
          graphParams.funcs.clearResult();
        } else {
          var searchResult = graphParams.funcs.findInTree(
            graphParams.data,
            value
          );
          graphParams.funcs.reflectResults(searchResult);
        }
      });
    }
  }

  function searchItems() {
    d3.selectAll(".user-search-box")
      .transition()
      .duration(250)
      .style("width", "350px")
      .style("display", "block");
  }

  function closeSearchBox() {
    d3.selectAll(".user-search-box")
      .transition()
      .duration(250)
      .style("width", "0px")
      .style("display", "none")
      .each("end", function () {
        graphParams.funcs.clearResult();
        clear(".search-input");
      });
  }

  function closeToolTip() {
    tooltip
      .transition()
      .duration(200)
      .style("opacity", "0")
      .style("display", "none");
  }

  function findInTree(rootElement, searchText) {
    var result = [];
    // use regex to achieve case insensitive search and avoid string creation using toLowerCase method
    var regexSearchWord = new RegExp(searchText, "i");

    recursivelyFindIn(rootElement, searchText);

    return result;

    function recursivelyFindIn(user) {
      if (user.name.match(regexSearchWord) || user.id.match(regexSearchWord)) {
        result.push(user);
      }

      var childUsers = user.children ? user.children : user._children;
      if (childUsers) {
        childUsers.forEach(function (childUser) {
          recursivelyFindIn(childUser, searchText);
        });
      }
    }
  }

  // function back() {
  //   show([".btn-action"]);
  //   hide([
  //     ".customTooltip-wrapper",
  //     ".btn-action.btn-back",,
  //   ]);
  //   clear(graphParams.selector);

  //   graphParams.mode = "full";
  //   graphParams.data = deepClone(graphParams.pristinaData);
  //   drawChart(graphParams);
  // }

  function setClusterActive(activeIndex) {
    clusterArray.forEach(function (cluster, index) {
      if (index != activeIndex) {
        cluster.chartWidth = (window.innerWidth - 40) / 6 - 6;
        cluster.chartHeight = cluster.chartWidth;
        cluster.selector = "#svgSubChart";
        cluster.active = false;
        cluster.nodeHeight = 30;
        cluster.nodeWidth = 30;
      } else {
        cluster.chartWidth = window.innerWidth - 40;
        cluster.chartHeight = 700;
        cluster.selector = "#svgChart";
        cluster.active = true;
        cluster.nodeHeight = 50;
        cluster.nodeWidth = 50;
      }
    });

    d3.select("#svgChart").html("");
    d3.select("#svgSubChart").html("");

    clusterArray.forEach(function (graphParams, index) {
      drawChart(graphParams, index);
    });
  }
  function expandAll() {
    if (!isExpand) {
      expand(activeCluster.data);
      isExpand = true;
      $("button.btn-expand i").removeClass("fa-expand");
      $("button.btn-expand i").addClass("fa-compress");
    } else {
      collapse(activeCluster.data);
      isExpand = false;
      $("button.btn-expand i").removeClass("fa-compress");
      $("button.btn-expand i").addClass("fa-expand");
    }
    update(activeCluster.data);
  }

  function expand(d) {
    if (d.children) {
      d.children.forEach(expand);
    }

    if (d._children) {
      d.children = d._children;
      d.children.forEach(expand);
      d._children = null;
    }

    if (d.children) {
      // if node has children and it's expanded, then  display -
      setToggleSymbol(d, attrs.COLLAPSE_SYMBOL);
    }
  }

  function collapse(d) {
    if (d._children) {
      d._children.forEach(collapse);
    }
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }

    if (d._children) {
      // if node has children and it's collapsed, then  display +
      setToggleSymbol(d, attrs.EXPAND_SYMBOL);
    }
  }

  function setCollapsibleSymbolProperty(d) {
    if (d._children) {
      d.collapseText = attrs.EXPAND_SYMBOL;
    } else if (d.children) {
      d.collapseText = attrs.COLLAPSE_SYMBOL;
    }
  }

  function setToggleSymbol(d, symbol) {
    d.collapseText = symbol;
    d3.select("*[data-id='" + d.uniqueIdentifier + "']")
      .select("text")
      .text(symbol);
  }

  /* recursively find logged user in subtree */
  function findmySelf(d) {
    if (d.is_unknown) {
      expandParents(d);
    } else if (d._children) {
      d._children.forEach(function (ch) {
        ch.parent = d;
        findmySelf(ch);
      });
    } else if (d.children) {
      d.children.forEach(function (ch) {
        ch.parent = d;
        findmySelf(ch);
      });
    }
  }

  function locateRecursive(d, id) {
    if (d.uniqueIdentifier == id) {
      expandParents(d);
    } else if (d._children) {
      d._children.forEach(function (ch) {
        ch.parent = d;
        locateRecursive(ch, id);
      });
    } else if (d.children) {
      d.children.forEach(function (ch) {
        ch.parent = d;
        locateRecursive(ch, id);
      });
    }
  }

  /* expand current nodes collapsed parents */
  function expandParents(d) {
    while (d.parent) {
      d = d.parent;
      if (!d.children) {
        d.children = d._children;
        d._children = null;
        setToggleSymbol(d, attrs.COLLAPSE_SYMBOL);
      }
    }
  }

  function toggleFullScreen() {
    if (
      (document.fullScreenElement && document.fullScreenElement !== null) ||
      (!document.mozFullScreen && !document.webkitIsFullScreen)
    ) {
      if (document.documentElement.requestFullScreen) {
        document.documentElement.requestFullScreen();
      } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
      } else if (document.documentElement.webkitRequestFullScreen) {
        document.documentElement.webkitRequestFullScreen(
          Element.ALLOW_KEYBOARD_INPUT
        );
      }
      d3.select("#svgChart" + " svg")
        .attr("width", screen.width)
        .attr("height", screen.height);
    } else {
      if (document.cancelFullScreen) {
        document.cancelFullScreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      }
      d3.select(graphParams.selector + " svg")
        .attr("width", graphParams.chartWidth)
        .attr("height", graphParams.chartHeight);
    }
  }

  function showCurrentItem() {
    /* collapse all and expand logged user nodes */
    if (!attrs.root.children) {
      if (!attrs.root.is_unknown) {
        attrs.root.children = attrs.root._children;
      }
    }
    if (attrs.root.children) {
      attrs.root.children.forEach(collapse);
      attrs.root.children.forEach(findmySelf);
    }

    update(attrs.root, { centerMySelf: true });
  }

  //locateRecursive
  function locate(id) {
    /* collapse all and expand logged user nodes */
    if (!attrs.root.children) {
      if (!attrs.root.uniqueIdentifier == id) {
        attrs.root.children = attrs.root._children;
      }
    }
    if (attrs.root.children) {
      attrs.root.children.forEach(collapse);
      attrs.root.children.forEach(function (ch) {
        locateRecursive(ch, id);
      });
    }

    update(attrs.root, { locate: id });
    activeCluster.funcs.closeSearchBox();
  }

  function deepClone(item) {
    return JSON.parse(JSON.stringify(item));
  }

  function show(selectors) {
    display(selectors, "initial");
  }

  function hide(selectors) {
    display(selectors, "none");
  }

  function display(selectors, displayProp) {
    selectors.forEach(function (selector) {
      var elements = getAll(selector);
      elements.forEach(function (element) {
        element.style.display = displayProp;
      });
    });
  }

  function set(selector, value) {
    var elements = getAll(selector);
    elements.forEach(function (element) {
      element.innerHTML = value;
      element.value = value;
    });
  }

  function clear(selector) {
    set(selector, "");
  }

  function get(selector) {
    return document.querySelector(selector);
  }

  function getAll(selector) {
    return document.querySelectorAll(selector);
  }
}

var svgIcons = {
  machine:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADhAAAA4QBAwW54QAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKDSURBVHic7ZpNaxNRFIbfm0kwbWzRFNFuSipZNAiKIEQXaioiJeBOUFeCC12IETeCdOFFWsQuBOvSj7+gghQrStQGFESE0mKFiG60RhfW1i6aITmups5MI9hk5h5oz7O6HzPnPvMyd5ghAQRBWM8o/0BKF+NtsAsAsgB1MjiFgJqHotf25tpouZBf8sy4O2k91hmF9VIBu8wKmoLe2ajnyjo/74xE3NMxRK+v3YsHALU7BuuaeyTqPYBOOK0LuTT6tm404xUy7ysLGH3+0ekeB3DO6fgCwCancSrbE76ZIbKppDuALvdcZOXh6wsJgFuAGwmAW4AbCYBbgBsJgFuAGwmAW4AbCYBbgBsJgFuAGwmAW4AbCYBbgBsJgFuAGwmAW4AbCYBbgBsJgFuAGwmAW4Ab/6/Dy1x6MGXSg41/BvD0w3eTHmzIFuBa2FIKR3d2gwA8mpxFjYjFgy2A8/1pnNnfCwDoSbbjVrHM4sG2BbZvSSy30662adjugDulT+jb1gEi4HbpM5fGigAIDf48GQaTX37hyM0JE0v58Txs/Fvgm0ERLr66O/4A7hoUYUFBea7RE4CdrA0BeGjUyCz3FeaG3QMN93tGP8kDOBDQogqgAoB4E+feA9SP1gWIFOjFtB543EAuXHbo8UN14Fkz5xLoyoweuBq0k5tQA8jpYrSC6gSAvU2W+GnFrMzU4OFKkF5uAgsgpYvxjg2LbU7fpmpEVRMjAE63UleB3qi4fSxCasEZqy8l7Gnd/7uVun/rB0BGj98AcDGIWqvgVXt318G3Z/fYrRQJ6lX4ZEB1VsO+xdm53laLBPMqrDACwuXA6v0HBIzNoMTzBSUIgiAIwprgD/kjhKevoNhCAAAAAElFTkSuQmCC",

  "machine-expand":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADhAAAA4QBAwW54QAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKDSURBVHic7ZpNaxNRFIbfm0kwbWzRBMEsLK0ENCiKIqgLtZUiJaArQd260IUYcFlceBFF7EJQl2r/gihSrCChNqAgflBa6CKiIlqriLW1i2ZIjqupM9MINjNzD7TnWd2PmXOfeZk7zJAAgiCsZpR/oFOXki2wiwD2AtTO4BQBahaKXtjra7cqxcKCZ8bdyemh9jisZwrYaVbQFPTGRr27oguzzkjMPZ1A/PrKvXgAULsSsK65R+LeA+ik0zq2O4dNmbVmvCLm0485PHz9zumeAHDO6fgCwDqn0bu9I3ozQ2zJpt0BZNxzsaWHry4kAG4BbiQAbgFuJABuAW4kAG4BbiQAbgFuJABuAW4kAG4BbiQAbgFuJABuAW4kAG4BbiQAbgFuJABuAW4kAG4BbiQAbgFu/L8OLzI4Mm7Sg41/BvD24zeTHmzIFuBa2FIKR3dkQQAejU2hRsTiwRbA+Z4czhzoAgB0pFtxu1Rh8WDbAps3pBbbOVfbNGx3wN3ye2zd2AYi4E75A5fGkgAIDf48GQVjn3/hyM1RE0v58Txs/Fvgq0ERLr64O/4A7hkUYUFBea7RE4Cdrl0B8MCokVnuK8xcdQ803O95/aQA4GBIiyqAigCSTZw7CKjvwQWIFGhkQvc9biAXLdv08OE68LSZcwl0aVL3XQ7byU2kAXTrUnwa1VEA+5os8dNKWPnxi73TYXq5CS2ATl1Ktq2Zb3H6NlVjqpoaAHA6SF0FeqmS9vEYqTlnrL6Qsid0z+8gdf/WD4G8Hr4B4EIYtZbB89Zs5tCrs3vsIEXCehU+FVKd5bB/fmqmK2iRcF6FFQZA6A+t3n9AwNAkyjxfUIIgCIIgrAj+APDRhO3KkrbwAAAAAElFTkSuQmCC",

  "machine-expand-unknown":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADhAAAA4QBAwW54QAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAS4SURBVHic7ZpfTFtVHMe/p7elLS1/Wv5I2fgzUjY62WCbZDPLdBPEBePiEhM18ckHZ1wkUZ+MD94YjXEPJs5oYtTF+GhijH+yyOZCEOJMFjYkzMGAAHOjFBgtLbWlt+3xYRbu7S3Owb3nJOx+nnp/5/Sc7/n2nHN/99wCBgYG9zMkO1ArdtvskDoB7AdoIQdNOkDCIPR3yZU6PdbZsawokV94xbOFZgi/EqCJrUBW0CsS0ofHxI5wJmKSF1tg/mDzDh4AyB4LhPflEbOyAn0u8+nYXi+qSpxsdOnMX7cj+OHyeObyWQAnMxdZBqA486GtsVp/ZYzY4XHLDSiRl5nU1e8vsmeA7sSkJMZnQrixEEE0nkCaUjisefAUO7Dd40KBLY+pHmYGJNNpdA1OoufaTcSlZM46AiFori3H0/u8KMq3MtHFxIB4MolPzw9gci78n/VSlKJ/IoARfxCvd+xDqdOuuzYme8A3F6/fdfByluIJfNUzBEp1FPUvus8A/2IU/RMzqnip047m2nLkmQWMTC9gfDakKL9xO4IR/wIaKt266tPdgMGpOWT/kJXFDrzxZAsswp0J+MSuGnxyfgDXZ4KKesMMDNB9CcyGY6rYoYaqlcEDACEE+70Vqnqh6LIqpjW6z4CDOyqxq0qRe6CuvEhVL99qUcUYbAH6G1BXph5sLqZybJLlhZvkLnA35pdi6Ll2UxEjAPbUPqB739wNWPx7GZ/98gdiWcnRgXoPKosduvfPPBWWE44t43TXZcxFlBvlVrcTx1vqmWjgNgNi0p3sMHvwpU47Xm5tgs3M5rfhNgN+7B/HdCiqiG1xOXHy8WY4GT4QcZkBsUQSv41OK2JOqwUnWnczHTzAyYCxQBDprET/eIsXxfk25lq4GDC/FFdcC4SgsaqMhxQ+e4CUSsOet5r5uRxW2C18tiMuvbY31qC9sYZH1yq4J0K84XYbnF+K4dZCBFaLGdsrXDAR1UsqJnAxYGBqFl/3/olkOg0AqK9w4ZW2Jggm9hOSyxL49tLoyuABYHQmiCuTszyksDeAUopoXFLFwzliLGBuACEEO7cqD0gEkwm+Lfoefa0Flz3ghYM+nCu0YzywCIfNgtad1fAU6f/omwsuBtgsZhzb6+XRtQojD1ir4EzPEEsd3FjTgIEpPrcl1hhLgFfHAiF4arcHFMBPg36kWLwIzAE3A1494sVLh7YBAKrd+fi4e4yLDm5LoK5s9b7vLeOTAwAcZ8AXfRNoqCgApcDnfZO8ZKgMoMjx50k9GLy1iPaPell0lY1is8leAuoX+ZsPxXF0tgFfMhTCBQKiGKPCAMmdehfA90wVseU7gtB78kDO9e4Tz3UAeESjTglAOwGs59D/DEDmNi6AUgLac1U8+nMOcfryoNj1WBq4sJ7vUtC3h8Wj72itSY6uBhwWu80BJHoBHFhnE0HBIviG3moLaKlLjmYG1IrdtgJrdOUvHRJNmEjCcQrAixtpl4BeIjbpGRMlkUwsveyQropHljbS7mr7GuATuz4E8JoWbd0DF/M9JY/2n3hoQ4eJWqXCz2vUzr3wcNQf2rbRRrRJhQlOgeJNzdr7H1Dg7DD6+DxBGRgYGBgYGGwK/gG4LEu16vs0hgAAAABJRU5ErkJggg==",

  "machine-unknown":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADhAAAA4QBAwW54QAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAASxSURBVHic7ZpfTFtVHMe/p/f2D/3DtjJaMYzQrWlAsimGBafZZGRRJPFpSxBe/POwPSxi9rJoNPFmmRpndHEmxmVOn4wvJopZUMgWdODm5hZjA9I5GIgZpRvjTwuD9rY9PhXubYtscO85ZtzPU8/vnHvO93z5nXNPTwEMDAzWMiQ7UC512QogtwKoBWghB006QKIg9Fd5Q+rEQGtjXFWjLPil9kIRwnkCPMpWICvo7zLSdQNSYzQTMSmrzRDff3AnDwCk2gzhPWVEVDegL2Q+vVbnR4XXyUaXzvRHYjjx02Cm2ATgYKaQZQDWZz68WFumvzJG1Ja7lQYUKetMuc3XFtkZwIRUmmJkcg4TdxNIptKwiCYEPE44LOzlMB1xdHoOJ3uG0RmKIJ5Mq+oEQlDrc2P/U+XY9vA6ZpqYGXB+YBxvnfkTM/Fk3voUpbhw4w4uDU3gUL0fLTWbmOhisgcMjs/i9bbeJSevJEUpPjx3HT2DdxgoY2TAZ91DmM9KebfdguaaUrTUbIKvyK6qowBOXRhiIU3/JRBPpvHLjXFVzG234OuXt6PYaQUAzCe3oOXLyxieuLvQpi8cQyyehMuqr0TdMyASi+f89RurvAuTBwCbaEJ9oFjVJk0pbsdUx3Zd0D0DPE4LvnppuyrmdVlz2tnMQk5MFPRfobobYDMLqPS6lm13aXhCVXZaRZQU5hqlNf+Lk2BbMIyr/0ypYg2PeGFmkAHcDWjvG8PRjpAqttFhxcFdm5mMz+UonKEtGMaRH/pBFbFCmxmfNj2GdTYzEw3cMiAUieHdzmuqybusIo7v3Qp/sYOZDm4Z8MHZ65BTi6/HArOAk83VqLiHDVNLuGTA1JyMP25Oq2KH9wSYTx7gZMBft2aQpovJ77CIeK7Ky0MKHwOi87KqHPA4YWHwyssHlz1gh8+N7w88uVC2mXNu55nBxQCHReRy+5MPbirGovPoj8TgsIioKVsPE+GTBVwMuDIyidZvgpiXUwCAnVs24vjerVxM4LLznL7498LkAaB7cBzB0eh/PKEfXAyIJ1M5sUTWnQEruBjQ9HipKt0DHieqS9ndBCvhsgc8W+mFr8iBKyNT2GAXUR/wMPnqmw9ub4GAx4mAh/9vj9zvA3iz5g1Ycgkc/q6XpQ5uLGnA2Wu3WOrghrEEeA0sEILnt5WAAjgTDCNF6bLP6AE3A17d7cf+nT4AQJnbjk+6Brjo4LYENisuPllegmbDLQM+7xlCxUMuUAqc6hnmJSPHAIo8/zypB8Gb03jm424WQ2Wj2myyl8AYQyG8GFUWsg04zVAIFwiIao4qA2R36iiANqaK2PItwdQ7ykDe9V4pdTYC2KXRoASgrQBsK3j2C4DcXr0ASgnoz31Sw495xOlLldRRnwbOreRZCvp2SGo4orUmJboaUCd1iREkugE8scIuJgWzUNn75p6IlrqUaGZAudRlc1lnCzJlmSZMJOE4BuCV1fRLQH8jNnmfiZJYJpaOO+Q+affMavpd7F8DKqWOjwAc0qKv++CivaTo6asHauTlmy6NVkfhZo36uR92zIanfKvtRJujMMExULyhWX/3AAXaQ+jh8w3KwMDAwMDA4IHgX9ZHQ5H/7cjMAAAAAElFTkSuQmCC",

  "machine-windows":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADvUlEQVR4Xu2bX0hTURzHv8cpapoVSSX2YGDYCCwiqJfKRJoI1Yv9eeohooJAkx4iCna0XoroYUESRNRjFkpR0rXMMsIgNBJ1GmYGOZ0m5p/MOe89cafX3HBzu7vb7uY5j7vn9zu/7+f+7u+cc88dwTJvZJnrBwfAM8CDQBZtSEpmzhIQ7AJYWmwAImMg7KNzjWjpLilyLNTk9ghk09q0eBgaCbAtNoR7qGDss5NIed20aEy54gbASOsqAXY2JsX/F3XHSk3nvAAQRgCsli+W5mVjy/rUmGBhtY/D8vbbrBaGYWu5Kd0bAKZcaLmYHxPiFRE7rr+Z12OlpvnM93gEBA6AZ8AcAf4I8BqgjyL4YVjCtU4RzaMSBosSVRdm3RZBueo+7hPxsFdE9yRg+8swX4k95E4cilIAA1MM1X0S6n9JaPnNMOSYlSgLSn3mtjL1eYejDkD6CwemRO+aOACeAfwR4DWAF8FYngUe/BAx421SB3Aqy4B7vT6mCY8JRO6vtkVkIVRtEyH6AHAk0+BaBPnb5P5qW0QA8HUAXwjxlSBfCvO9wHLeDClTlmCXUPVTROs40DUmQpo7koz53aA/c7b8ruDudwlP+yUMOCSMOX1vn/3xuVifiKwD1Aa70K7GJsHcMYOeSeZ6gaK2RS0AtYI97TgAfjLEj8b42aBCwK/D0YKcdVrVH134ed01GFgG6CLqEAXhVwaEaGxduNUFAAMhOJib4ToGe97aD5H5eHWkMTZdADifvxmn92xySats7MHthm6NZXp3pwsAlmPbUbBlttC+stpRWvVleQHIzVyFm8W5kDP/wpNWtNlGdQDALMg71dj+fJaBWctNcQpt94+kzIINBBlhuxWRGajPSk0bFwdAhasArkQmrvCMSkAqOugB86IAsi21iQnDhkcgOByecMI8CkNNHBk93k6PTi8KQPnRaK4rAsFejcIjACsBkKTC332ADKmwczMhYIyAvWunhS89fYW84G2lQr4E1KsRwcDMnbSwQo2tvzYhBZBHG+LtmH4PYLe/AXn0GzEkGIxtlwvsKu2XNNMMgPw/g5WJf5KVEZ1sOo5Mp9wAcHLJKHx0IGCfSJKzOI6RcaWb5EhxttP9E8H49VkDAnVsNAu3QFAWqF2Q/ZtWZKzd13xmp4/3yEuPoEkGGKnQD2DD0sNp24MxQ05necHXYLxqA6BcKAPDJQDxwQQTiC0DajvRdAKUSoHYhX0WCCa4cNhqkgHhCDRUY3AAoSIbLX55BkTLnQpVnDwDQkU2Wvz+A5WkT18kJ9I+AAAAAElFTkSuQmCC",

  "machine-windows-expand":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADm0lEQVR4Xu2bX0hTURzHv8dN1CwrjGhkZGDUiEyiqJfKRJqI1YtoT0I9VBCspF6iYGf2FtHDgoQeCnpKCYIo8Rop2YOBmSbaJDQQzX81RC3Uzd0TU+9yc5u7u7v7cz33cef8fuf3/ex3fud3ORvBOn/IOtcPDoBngB+BXNqSnsFcZhAcA1iWNgCRaRD2ybXVbes3l86v1OSzBfJoQ5YeulYCHNKGcD8VjHW6iFjYT0unpREfAEbaVAuwq5oU/1/UYzs1XQsCQJgEsMUzeO5wHnZlb9QEiyHHDF5/GVjSwuCwW03bggFg0oCtqkgT4iUR5ufNXj12avJmvt8WEDgAngHLBPgW4DUg9kVweE5E428RXdMiBmcBl7hUkhqPpikuyAlTBIfmRNSNibiVq0dZhxMLyyJDKUxaAJWdTsy4AZF5DxevTo+oknafrjQog6QFEEogB8AzgG8BXgM0XwSfDbuDVvaLOTqEGl9p6Jmr9IlLH1A/GhxAhUGHUOMrBXvmKn3iAoAfgyEaHd4H8D6A9wHa7wPKPs9jYfV7kPcVV/N9QKCjq9nhxosREU8Opmo/A+Se3Z3TIt5OiBiYFTE2xyAlT9K+DssFoOb8uDRCagqS65sD4Bcj/GaIX41JBPjdYDiXowW7t8sttAk9v2twQt4WSGg1CoMLawsoXCOhzRMCgI4QnM03LLa7b7pH4Q5we6QWxYQAcKNoLy6f2LOosbb1Bx619Kuld5XfhABgqyxA8f6lQvvOPo7r9V/XF4D8nZvxoDwfnsy/+bIbPSNTCQDAIoggGv/5LAOzW00pEm3fH0lZhBEQGGL2VcRnoZ92asoJDIAK9wDcjU9csVmVgNR8o2csAQHk2RrSUh26OhCcj004MV6F4VUKmbrQSyucAQFIHxotTaUgOBml8AjAzADSI/D3FCC/IrDzMSFgjIB96KUljf6+VP+/wAEqFInA+0hEMDBLHy2picQ2XBtVARTSFv04nB8BHA83IL95k7pUnbHnTvF4hPZrmkUNgOd/BpvS/mZIK7qYM4U4M+8DuLRmFCEmELB2ku4qT2FkRpomzme6eunpP0r8hqwBch0bLcJDEFTLtVM4v22DIftUx5UjLiV+opIBRiqMAtihJJBIbBnT7euzFn+PxDa6GWAVqsFwG4BeSTBybBnQ0Ie2KlAqyrGL+SmgJLhY2EZlC8QiULXW4ADUIpssfnkGJMs3pVacPAPUIpssfv8BK0scXwTI6Z8AAAAASUVORK5CYII=",

  "machine-suse":
    "data:image/png;base64,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",

  "machine-suse-expand":
    "data:image/png;base64,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",

  "machine-rhel":
    "data:image/png;base64,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",

  "machine-rhel-expand":
    "data:image/png;base64,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",

  "machine-linux":
    "data:image/png;base64,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",

  "machine-linux-expand":
    "data:image/png;base64,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",

  "machine-noaccess":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMkSURBVHhe7ZrLSxVhGMalqGgRXRbt2vYPuGkXkSPKDAo1H4Hbok2b1FUUHNJF2bJNEXRBwcuJQG1ldKGTWq7CoAhbakiQrooTREzfHJ6jD70vpDhe3mF+8MBZPPOc+Q0fczanoaCgoIBpaWnZF0SuMwjj4ebIlfOQmksYX3bO7YWmzsn29kNB6Gb9RUkek7o1NbmD0JU0h+6udmGe4k/DHehKgiherhcfDZST5y/f5CKpy8pDCN136EpWSj7V6u9chd2gK+GSNmI57AZdCZe0EcthN+hKuKSNWA67QVfCJW3EctgNuhIuaSOWw27QlXBJG7EcdoOuhEvaiOWwG3QlXNJGLIfdoCvhkjZiOewGXQmXtBHLYTfoSrikjVgOu0FXwiVtxHLYDboSLmkjlsNu0JVwSRuxHHaDroRL2ojlsBt0JVzSRiyH3aAr4ZI2YjnsBl0Jl7QRy2E36Eq4pI1YDrtBV8IlbcRy2A26Ei5pI5bDbtCVcEkbsRx2g66ES9qI5bAbdCVc0kYsh92gK+GSNmI57AZdCZe0EcthN+hKuKSNWA67QVfCJW3EctgNuhIuaSOWw27QlXCpMvM5V2E36Eq4NDw+nauwG3QlXNJGLIfdoCvhkjaSZUaevk3evf9SS/pZ62QZdoOuhEvaSJb5NLeQ1Pk4N692sgy7QVfCJW0ky8wvLkE/qX3WOlmG3aAr4ZI2kmWeVT4kP37+qmXi9azayTLsBl0Jl4bGptQhixkcnVzjAwjjr/XSpa5ScrXndi6Suqw+gHgBupLm0PWuFvOZIIyvQ1eS/pfWn4Jx7cI8JAjd6H//L5wSRGdb09MQRPHNjaYpcn2dV25Uu6/1JevNmY4L97XN9cYf+57UCXpby/Do5CntxbTGlDBjk3K5vNtLTP0jtfaMTS/3P5k6irmdzYk43h+GHYfriePzRx4MTdzrf/wq2UgejryY6erqPcbbbW1tB/C1OwP/4rzl365/tBfPZiWIXKWx8eIe3ML24l80i9pNbnZOt547jlvYXvwJ6Pa/Gt/8g1jeoiz57xwslUq7cAsFBQUFBQUFBeukoeEvJ7GfoYE/hBoAAAAASUVORK5CYII=",

  "machine-noaccess-unknown":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADhAAAA4QBAwW54QAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAATzSURBVHic7Zp7TBxFHMe/s7fglZdHNNaWoxSsUgoBsbbWGi22aSu2tMYQHgUr1KTG1NAYTYypsQk+GvnDRBON2lTFQDFitWB5aMOzvqGoSKXA0XLleAUocsch7XE3/lEPbm+vKS27M9ru56+b38zN7zvfzOzO7iygoaFxI0O8A0lJOXq/oIk8EHIfoQjhIUppKIGVUPykc068U1VVdcGzTmJAcnJWiFN3sRFAAlOFjCDAr4LTP6mqqtjqjgmeDaZ1F97EdTp4AKBAolNwHPCMiZ4FApLh/v1kdibuiIxkpU1Vus+cRWFxyaUCoekA9rjrRK+2BvePx7ensNDGhIT4uFkDgFs86wR58xsL7xmgKhN2O2rrG9H6xyn09llgs9kh6kQYDMFYFhWFVffeg1UrV0IUdcw0MTOgtr4RBz8uxOTk37K6ces4zOcsqKlvRLhxMZ7fm4fIpUuY6GKyBMqOVeLtd9/3OXhvei392Lf/VfSYexkoY2BAr6UfhUUlV27ogX3Sjvc+OAhKqUqqZlF9CVRUV8PpdEpiev1NyM5Iw90J8ZiamkJF9XHUNTRK2nR0mWA+Z8HSiHBV9aluwO+tbbJY7hPZeGTThpny3j1R6DGbcbbHLGnX0dmlugGqL4HhkVFZ7IG1qyVlQgjiYlfI2lltVllMaVSfAV8cLpxTO4HInsuwQL9AaTnyvKpnmAMulwvNLS2yeFRkhOq5/xMGFJV8jr7+QUnMGLYYMcujVc/N3YAjR8tx5Gi5JCYIAp59ZjeIj2WhNFwN+LLsa3xa/Jks/vRTuYiJvouJBm4G1Dee8Dn47Mx0yS1SbZg+DLmx2+049EmRbKeXuzMLj6VsYaqFywz44ecmWG02SWzzxvXMBw9wMqC9/bSkLIoidmZl8pDCx4DR82OScmzMcgQFBvKQwucaEBa2CBSz6z8xIZ6HDACcDNi9K4dHWp9w3wjxhssMcDgcOF5bj+GREdx+20JseHgd0/eAnjA3gFKK/DcK0Np2aibW3NKCfS++wFoKAA5LwNR9RjJ4APiluQW9ln7WUgBwMGDa6/WYG6dzmrGSSzA3YFlUJJaEG71iUbIYK5hfA/z8/HAg/xWUV1RjYGAQRmMYtiZvhiDwuSFxuQsEBQVhR3oqj9QytH3A5SqaWrtZ6uDGZQ3oHzrPUgc3tCXAKzEhBBHGWwEKmPtGmJwD+oKbAXHR4VhxZxgAIChQj7YONqfB3nBbAiHBs6c+NwcH8JLBbwacNvUhNCQQFBTtpj5eMmQGUPz77SClVNWDidGxCRyrkR+HqYHX9UVSkBpAMAiKRQDwXcO3MBgkH1T9bxn7S3JCLXnslBpAySGAvgwAXZ1/qi6MB5TikGdZchHUOW2vgaKMrSSmfGUIwOueAZ+LfOPWtEdBXA8pkVEgAomNS8wjgqC/2v/2dHd+ZJ0YH56vBkIJJS40fFNZWi2rm2/nV+Jw+ffrBZCaa/z7/oxta/MVFeSFqgbU1dWJQzb9CYCuucYuxlxUiNmxfc2QosI8UMyApKQcfWDgxZndjb9/qJCStq1AFP13zadfp8vV9FtLU6qprXXmMNEe4HDUl5ZOzKdfN4oYsGlL6lsg5Dkl+roKfhwdCF138uSHjvl0osxWmBAeJ5v3GxaOz/t7fmW2woQUgNKXFOtvbkkrH1wdY6qpZJdRQ0NDQ0ND4/riH5+2ciQd1nNYAAAAAElFTkSuQmCC",

  process:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAvtSURBVHhe7VxpbFTXFaaLukuVukiV2v7qov5p/7XNr1ZV47HZmxTaIpW0pAkqP6gKSdNWtIIS8NgYCBASFidAKRQCJBDMTsPi2G+8YMxmMOAFjO2AAdusNsae0/O9uWfe8/iMPTOemTckHOmTR3Pfu/d8n+9997xzrj3isT22j7b9dPbhT2blBn7s8wde8OUFCn1+qzjbbzXw53b+2QOYzw3ZeYGjuIZ/zsQ9E7ds+YTp5qNlOUv3fDrHbz3FYrzDwt1mQSgR+PKsWyz429n+svHo03T/4bWc+cVfZdIvZ/sDN91CPLPyBM3b2UD/Lv2A9tZ0UkXTfaq51kN17X028BnfoW0dX4NrJ6+s7icm+kTfP88t/7IZ7sNjvEy/wEvQz7grhKesPkmFxS1U3dJNjZ3BhHC8udvuA305Qlp3eVbnZhWc+LwZ/tE2LNXsPKsJ5HIYL246RwfP3VIFGQ7Q56rDLfYYISEDl7PzA+OMG4+e8az7DAu3SmbG1DdP0aHzt1XyyQKs/X6QFu+7HJ6R/JxdAV+MW4+GjZ5nfZ1nQDUIjCkopzfeb6GGDp10stB2z9bPNkhZ0dRFYwsqZDZWwyfjXmabb37p9/gZdAmOT15RTcX1d1TCyUZo/oWsp4/ovcYg7bv4kKauqTEz0WocmVv+XeNmZtqT+YHv8JJpg8PT1p2hM7x7amSTjWt3jXLGqq8GaU9dCPvqg/S3rXUyE6/5cq1vG3czy3Lyyr7BMdkVODpj4zmqvdGrkk02Ghh9runXeofC4rlFnPPupdBM5NUBX43bmWETFlmflWfeH9eepvNpEg+46pp93b1EBxv6iyfYyyL+fVtoJrKIVRkVeLNDK+EYnnmnr6Zn2QKYfb2u2VfZqosn2F/fR8+9cdqIaL1m3PfWQnFegEYvKKfiuvRsGAIsV7GmWwOXroZ9dQ95dy63RczyW2MNDW/MfsMwQfKa91tVkqmCPft4t4Xd7yE6EGXpuoFn4YlrQVp9tCX8PBwz+9jnDJ30m/16xo4gSK7v6FOJpgotZvZhBZe16IK5ceRykC60h+6Fr88VngqJyO/Phk56bczCY1/BeydenQ5fSO0bhgbEerCGjiGWLs+6Cn42NkYE8v+rvWULyLjjSQKC4735cADvtm7H0oHm26Gd484DspelKhwDO3LNdb0PAOGWEfFfhlZ6bOLsM5/isMVOSaUiMTAYGm4F6QGHK0HWsPSKLhyAtvohXh9lFvKOfB2cDL3UGw/6NAb+Q+FJ1bFU4goLCLtwUxdONgrtXg3hVFg6MzfIJGNQ7GaaUykDz6iuh0Sd3WQHxpHi2RsFC6veGwWrjzSHBPRbWw291BpqGEilY9DhJEOj4XQbvzVcDNKGU31UWBUCPuO7Gm5D4FzcFCFelI0iFlQ1dxkBAx1pqbHwe+QTGBBpeM2hRIHn1R4WadWxPloZBWjbeb6/eENtFLHgt/wGBU45uaU/NDRTZxx8voDB5hc1qM4kAuQKt9YEVdE0rDsREi+WjSIWzNtZH9pM8qw/G5qpM37+oaxoF4A0ZxLBbp55mlCDYcc5va9EgEIVOCGDbmimzuy6LQ+GCpnmTLzAMy9y2b5S0kVT1tTS6IIKG/i8sPhev2tW8bMR92p9xou9ZzqMgIGjhmZqLFRdC8V/lVe6VGfiBZaiW5hXSrto7MJKIRQGvkOb+9p9fK/WZ7xA+j80jnUDHA3d5BlS4fx8WMIDdAqhZGWbscO6RXmWZ5uMEYln157vdy3u1fqMF0jBOeNYneA67PQ/tnQEl9zhfo6Rgm4iQN3N5DhfeLy/gKMXmkKQArS5r8W9Wp/xAlwGjGdzZu6sQVzhDZIEvtzAX/m30DigUxdSJqBU0hSkVUAXoAU0gTZGpoHGF/2In2/rOEzp1jqJRKqWMDYMbTwAbe5rU7OEo8PWBhqxVkY2x7QbBkOyNhG8YbhFwW47ZtHATQTfLYrYiZO/icQOI5tj2kWDIZVhzBIOY7BhYMmOYWDmRYqXojAmZhjZHJOGUQtC9YKhgOBTcyYRbK+NP5BG+KP1lQicQHpwjHRpY2RzTBreOdtD/v2t9LvVoepVNOCImeZMPMBrmOT08HqmCaVh69nQ65/WZyKY+27oVS4aJq04TS/taKVlZQ/C3xnZHJMGkBFsOH6P/rHjMk1Ydjx8o2DC0io62/ZQdSgWIAEQWcM9UD9EMoGXLa5LpnhVzd00TgmdnlpynKZvvkwFR+/280HajWyOSYObUBh40Jd20IxNdfYzSa4dXVBOs7ZdoKKT7XahRnNwAJg8Uk9IQbnHOMPPMxiExeaAHRZhCoDP+C5Zz7yL7b20/OAVmvRaVZiLzYe5Pb/+Is090EErK/v/8oYnoAs7ah/Soveu0fNrzyKLG+5w4rJjVLDnEpU23FWdBpDsRNIzss+j/B1KlEiWJpLTixXbq2/YFcQcl9/gMHl1Dc3a1UbLy3pU0dyQ+4xsjklDJLnB8NapLpq7q5kmvX7CcYghp09Ptj4IO480u1YAQmYZGWYY0vVuwslASf09+stmJCb6b44TXj1BM7c124kLTahokPuNbI5JQyTBWLG24ja9tLWRxi92YriR+WU087/naHXJdSo636veV9ceEg+FIhSMNBHiRU1bD+XvaqRfLu0fT47lWHLahgbyH7qtihMLpC8jm2PSoJGMB0UX+2h58U2atr6Wt/2y8IDjFlXQi1vqqbCsk3aba61m51wfSpWaGLGinrGmpJV+v6raOebLQOgx5c1amr33Jr1e2auKEg+kXyObY9IQKchwEC0k+tWr1TSnqInqr3fZ4qFIfilCkFix72wHTV9/huNX55cF/MYVemhCJArp38jmmDRoQiQDWkhkHzrfWEMbA1fjCokQevzz7Yv0C9fjAkDo8ae3BoYeyYSMZWRzTBo08kmFKyQa6wqJcJZ6sJBoqNDj5UFCj2RCxjWyOSYNKukUIZaQaNDQoyi20COZEB+MbI5Jg0Y0HYgWErkRDj0iUvvphPhiZHNMGjRy6cYaJSTKG0bokUyIP0Y2x6RBI+QVii70hh3WyHgB8cfI5pg0aES8hPilkfEC4o+RzTFp0Eh4CfFLI+MFxB8jm2PSoJHwEuKXRsYLiD9GNsekQSPhJcQvjYwXEH+MbI5Jg0bCS4hfGhkvIP4Y2RyTBo2ElxC/NDJeQPwxsjkmDRoJLyF+aWS8gPhjZHNMGjQSXkL80sh4AfHHyOaYNGgkvIT4pZHxAuKPkc0xadBIeAnxSyPjBcQfI5tj0qCR8BLil0bGC4g/RjbHpEEj4SXEL42MFxB/jGyOSYNGwkuIXxoZLyD+GNkck4Z1lXdUIl5B/NLIpBtIqYk/RjbHpAFAUhPJzS2nu1VS6YT4pBFKB5C8RRIXyVy3RkY2x0b6re9zw2Kf3/ogfGF+wE63Lz7UZqffNYKphviikUsVUCZAuQBlA3epwZdn9eXkBapG5QWeNrINNJwHzskNjMrOszb7/IH7cjPOxMzYXGcXhFAY0simAjK+RjSpqOyzC1MoUKFQJeP68DM/cDkn15rN2sT3F51P5h37os9fNpU7Ouo+aI7S5KztTXapUiOdTMiYKukkACVQlEJREpWxDDp9uWX/8S2s+KaRY3iWs6DkW9n+wByelXXugVA0R/EcRXRNgOFCxtHIJwoU21F0R/HdzYW59TDHI6PyS35maKfAiD6W5S/9CS/xVfibChkcJ1txnAPHOnC8QxMjEUj/mhDxAMc6cLwDxzzcJ02ZQzA73zrr85dMZ24fNyzTY/iHO77cwK/54bqbf3u94tT4RZV2VQ0HjjRR4oH0qYkSC3CQCAeKcLBI+gLY5zZeokuYw5cMHW+NZ+DXsvzWDBbylNtRCYlQ99UEGgrSjyZONODImhZ68IbQlZVr7chZEPiBcTszbbCQCCcR4gmJ5H5NKDfs0GNXgqFHptqgIdGm2EIiuUcTDaEHjuMmNfTIVBssJMKprWghkVznFg6hBw6Apzz0yFSLFhI9o4RE0iahB/7kwH1PekKPTLUoIRGOBktIFP4uU0KPTLVoIZEbGRd6ZKq5Q6JHJvR4bI/NAxsx4v9UFYfgKo+Y8QAAAABJRU5ErkJggg==",

  "process-unknown":
    "data:image/png;base64,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",

  "process-expand":
    "data:image/png;base64,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",

  "process-expand-unknown":
    "data:image/png;base64,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",

  "application-all":
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQfkBxcQBwxkPjmeAAAAAW9yTlQBz6J3mgAAAkhJREFUaN7tWb1OwzAQ/pykFMFAVyQWeAJeACEkdpB4AQYeghGJgYEn4AGQGJAYWJmQEAIGxIwQCxJjVQZo0zRmANo6sc9ObKc/4vPQOrbvvpzvzlcXGC8c85DDYwt4ViMTetyYqQVm0R7SOkygEvVZvcFI1OMkq+3M685Lm2gKxrOUGNxC5X2BbDgFR+q4cewLOm64QGAYX6XeXu9CR0Lv8fczyk+slzJxQI5G6AJgEpoRHEJlOY4eQY3AO+6F/paGQCp92sUMaRslVvAqeRfXILau6VxZQQs0sYln4clLtQSAqwosENiL8GgBjs/cs/nqCKzjWkGrIgK3hYWtuiUQI5KkFio4n5Qj6tOF9IGkwJskuCRGt8sRKIKQUEKBJBCjRi5miu95NJRbR+SBQ9QRkM28bmgpRwgCBwaCY6EnL/5iUgKxBT2EmpjfJQ9aM5A+0DOVYoGRnwXjTOAOTNu8ElgzWN6xJkA4YQeRJgrmSpbwhgRY4SiQV8W6XwwOEZZY4ywKdsik3VMSlFggKFXznGtnpNLjXWqBGj6c/zreU2yQ1AcSLLjZFwOMcyZ0gxAc3dERYEgAaXG73J/xw4OnxkKLYFCK5c4N8Y5ow5MF/koxdWAPiHm6J2RI0UIj83QJb6IFgAdPNuBgOfXoqxdQ1WUlo2zNvKu/yKgvUdTkb1VtpE1/Jvwn4IBANjKIKMrMPDVIblq/ZdwqRWrlay1gl6EXtcs9+0BbO2MSnHCiCejvVfVealcr2UdBymq6KWrRrv/7m0p8A2eOnj597+8WAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDIwLTA3LTIzVDE2OjA3OjEyKzAwOjAwP1X96QAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyMC0wNy0yM1QxNjowNzoxMiswMDowME4IRVUAAAAASUVORK5CYII=",

  "application-software":
    "data:image/png;base64,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",

  "appstack-all":
    "data:image/png;base64,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",
};

function getIcon(type, iconType) {
  if (svgIcons[type + iconType]) {
    return svgIcons[type + iconType];
  } else {
    if (iconType.indexOf("expand") == -1) return svgIcons[type];
    else return svgIcons[type + "-expand"];
  }
}

// function shiftText() {
//   var nameText = d3.selectAll(".item-name");
//   // .node();
//   var textWidth = nameText.getBoundingClientRect().width;
//   var rects = nameText.parentElement.getElementsByTagName("rect");
//   var parentWidth = 0;
//   for (var i = 0; i < rects.length; i++) {
//     tempWidth = rects[i].getBoundingClientRect().width;
//     if (tempWidth > parentWidth) parentWidth = tempWidth;
//   }
//   if (parentWidth < textWidth) {
//     var x = (textWidth - width) / 2;
//     this.attr("x", x);
//   }
// }
