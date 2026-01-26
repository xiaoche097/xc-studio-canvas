// Mock data generator for testing the agent workflow
import { AgentPlan, AgentResponse } from './types';

export const generateMockPlan = (keyword: string, filters: any): AgentPlan => {
  return {
    plan_id: `plan-${Date.now()}`,
    total_tasks: 4,
    estimated_time: "约15-20秒",
    tasks: [
      {
        task_id: `task-keyword-${Date.now()}`,
        task_type: "keyword_analysis",
        task_name: "德国站关键词趋势分析",
        agent: "keyword_agent",
        description: `分析Amazon德国站 "${keyword}" 的搜索趋势、排名及类目分布`,
        priority: 1,
        depends_on: [],
        params: { keyword, platform: filters.platform, country: filters.country },
        status: "pending"
      },
      {
        task_id: `task-product-${Date.now() + 1}`,
        task_type: "product_search",
        task_name: "市场规模与竞争格局分析",
        agent: "product_agent",
        description: `获取核心关键词 "${keyword}" 的热销商品列表及竞品数据`,
        priority: 2,
        depends_on: [],
        params: { keyword, limit: 50 },
        status: "pending"
      },
      {
        task_id: `task-market-${Date.now() + 2}`,
        task_type: "market_analysis",
        task_name: "轻杆竞品分析",
        agent: "market_agent",
        description: "分析市场价格带分布、中国卖家占比、竞争强度",
        priority: 3,
        depends_on: [],
        params: { keyword },
        status: "pending"
      },
      {
        task_id: `task-report-${Date.now() + 3}`,
        task_type: "generate_report",
        task_name: "生成选品分析报告",
        agent: "report_agent",
        description: "整合所有分析数据，生成完整的选品建议报告",
        priority: 4,
        depends_on: [],
        params: {},
        status: "pending"
      }
    ]
  };
};

export const generateMockKeywordResponse = (taskId: string): AgentResponse => {
  return {
    task_id: taskId,
    status: "completed",
    execution_time: "2.8s",
    result: {
      summary: "关键词分析完成，共发现5个高价值关键词，核心关键词'umhängetasche damen'在Amazon德国站的搜索排名为1,179，月搜索量约€101.3w+，主要分布在女士斜挎包类目下。",
      keywords: [
        {
          keyword: "umhängetasche damen",
          searchRank: 1179,
          trendData: [45, 52, 48, 55, 60, 58, 62, 65, 63, 68, 70, 72],
          monthlySearchVolume: "€101.3w+",
          productCount: "2.6w+",
          chineseSellerRatio: "64.8%",
          competitionIndex: 33168,
          categoryDistribution: [
            { category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags", percentage: 61.35 },
            { category: "Fashion->Women->Handbags & Shoulder Bags->Hobos & Shoulder Bags", percentage: 37.62 },
            { category: "Fashion->Women->Handbags & Shoulder Bags->Totes", percentage: 1.03 }
          ],
          products: [
            {
              id: "B08XYZ123",
              image: "https://m.media-amazon.com/images/I/71abc123xy.jpg",
              title: "LEQUEEEN Damen Umhängetasche Schultertasche Klein Crossbody Bag",
              rating: 4.5,
              reviewCount: 1247,
              currency: "€",
              price: "25.99",
              listingDate: "2024/03/15",
              salesRank: 156,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            },
            {
              id: "B09ABC456",
              image: "https://m.media-amazon.com/images/I/71def456gh.jpg",
              title: "Fossil Damen Ryder Umhängetasche aus Leder",
              rating: 4.7,
              reviewCount: 892,
              currency: "€",
              price: "89.99",
              listingDate: "2023/11/20",
              salesRank: 89,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            },
            {
              id: "B07DEF789",
              image: "https://m.media-amazon.com/images/I/71ghi789jk.jpg",
              title: "TOM TAILOR Damen Umhängetasche Rina",
              rating: 4.3,
              reviewCount: 2156,
              currency: "€",
              price: "34.99",
              listingDate: "2024/01/10",
              salesRank: 234,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            },
            {
              id: "B08JKL012",
              image: "https://m.media-amazon.com/images/I/71jkl012mn.jpg",
              title: "Gabor Damen Umhängetasche Mina",
              rating: 4.6,
              reviewCount: 567,
              currency: "€",
              price: "49.99",
              listingDate: "2024/05/22",
              salesRank: 178,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            }
          ]
        },
        {
          keyword: "umhängetasche",
          searchRank: 11010,
          trendData: [50, 55, 52, 58, 62, 60, 65, 68, 66, 70, 72, 75],
          monthlySearchVolume: "€85.7w+",
          productCount: "3.2w+",
          chineseSellerRatio: "58.3%",
          competitionIndex: 28945,
          categoryDistribution: [
            { category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags", percentage: 61.1 },
            { category: "Fashion->Women->Handbags & Shoulder Bags->Hobos & Shoulder Bags", percentage: 37.89 },
            { category: "Fashion->Women->Handbags & Shoulder Bags->Totes", percentage: 1.01 }
          ],
          products: [
            {
              id: "B09MNO345",
              image: "https://m.media-amazon.com/images/I/71mno345pq.jpg",
              title: "s.Oliver Umhängetasche Damen Kunstleder",
              rating: 4.4,
              reviewCount: 1834,
              currency: "€",
              price: "29.99",
              listingDate: "2024/02/18",
              salesRank: 267,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            },
            {
              id: "B07PQR678",
              image: "https://m.media-amazon.com/images/I/71pqr678st.jpg",
              title: "Tamaris Damen Umhängetasche Anastasia",
              rating: 4.5,
              reviewCount: 1456,
              currency: "€",
              price: "39.99",
              listingDate: "2023/12/05",
              salesRank: 198,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            },
            {
              id: "B08STU901",
              image: "https://m.media-amazon.com/images/I/71stu901uv.jpg",
              title: "Guess Damen Umhängetasche Noelle Mini",
              rating: 4.8,
              reviewCount: 723,
              currency: "€",
              price: "79.99",
              listingDate: "2024/04/12",
              salesRank: 145,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            }
          ]
        },
        {
          keyword: "crossbody bag",
          searchRank: 38812,
          trendData: [40, 45, 43, 48, 52, 50, 55, 58, 56, 60, 62, 65],
          monthlySearchVolume: "€42.5w+",
          productCount: "1.8w+",
          chineseSellerRatio: "71.2%",
          competitionIndex: 19876,
          categoryDistribution: [
            { category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags", percentage: 98.36 },
            { category: "Fashion->Women->Handbags & Shoulder Bags->Hobos & Shoulder Bags", percentage: 1.64 }
          ],
          products: [
            {
              id: "B09VWX234",
              image: "https://m.media-amazon.com/images/I/71vwx234yz.jpg",
              title: "Crossbody Bag Women Small Leather Shoulder Bag",
              rating: 4.2,
              reviewCount: 945,
              currency: "€",
              price: "19.99",
              listingDate: "2024/06/08",
              salesRank: 456,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            },
            {
              id: "B08ZAB567",
              image: "https://m.media-amazon.com/images/I/71zab567cd.jpg",
              title: "Mini Crossbody Bag for Women Cell Phone Purse",
              rating: 4.1,
              reviewCount: 1678,
              currency: "€",
              price: "15.99",
              listingDate: "2024/03/25",
              salesRank: 523,
              country: "DE",
              platform: "Amazon",
              category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
            }
          ]
        }
      ],
      expanded_keywords: ["umhängetasche", "crossbody bag", "messenger bag damen", "schultertasche", "handtasche"],
      recommendations: {
        top_keywords: ["umhängetasche damen", "umhängetasche"],
        opportunity_score: 8.5
      }
    }
  };
};

export const generateMockProductResponse = (taskId: string): AgentResponse => {
  return {
    task_id: taskId,
    status: "completed",
    execution_time: "3.2s",
    result: {
      summary: "成功获取到15个相关热销商品，平均价格€35.67，平均评分4.4，市场竞争激烈",
      products: [
        {
          id: "B08XYZ123",
          image: "https://m.media-amazon.com/images/I/71abc123xy.jpg",
          title: "LEQUEEEN Baby Diaper Bag Diaper Bag Shoulder Bag with Changing Mat",
          rating: 4.5,
          reviewCount: 1247,
          currency: "€",
          price: "25.38",
          listingDate: "2024/04/05",
          salesRank: 156,
          salesRankLast30Days: "#1,234",
          country: "DE",
          platform: "Amazon",
          category: "Baby Products->Nappy Changing->Diaper Bags->Messengers"
        },
        {
          id: "B09ABC456",
          image: "https://m.media-amazon.com/images/I/71def456gh.jpg",
          title: "Fossil Damen Ryder Umhängetasche aus Leder - Crossbody Bag",
          rating: 4.7,
          reviewCount: 892,
          currency: "€",
          price: "89.95",
          listingDate: "2023/11/25",
          salesRank: 89,
          salesRankLast30Days: "#856",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B07DEF789",
          image: "https://m.media-amazon.com/images/I/71ghi789jk.jpg",
          title: "Levi's Herren New Ashland Plus Belt Gürtel (1er Pack)",
          rating: 4.1,
          reviewCount: 271,
          currency: "€",
          price: "14.61",
          listingDate: "2024/11/27",
          salesRank: 234,
          salesRankLast30Days: "#2,456",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Men->Accessories->Belts"
        },
        {
          id: "B08JKL012",
          image: "https://m.media-amazon.com/images/I/71jkl012mn.jpg",
          title: "Jnidesier Fashion Shoulder Bag with Cute Accessories for Women",
          rating: 4.6,
          reviewCount: 567,
          currency: "€",
          price: "22.99",
          listingDate: "2024/10/06",
          salesRank: 178,
          salesRankLast30Days: "#1,789",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Luggage & Travel Gear->Messenger Bags"
        },
        {
          id: "B09MNO345",
          image: "https://m.media-amazon.com/images/I/71mno345pq.jpg",
          title: "Armani Exchange Large Bags MESSENGER BAG Damen Umhängetasche",
          rating: 4.8,
          reviewCount: 423,
          currency: "€",
          price: "75.00",
          listingDate: "2024/07/26",
          salesRank: 145,
          salesRankLast30Days: "#1,123",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B07PQR678",
          image: "https://m.media-amazon.com/images/I/71pqr678st.jpg",
          title: "TOM TAILOR Damen Umhängetasche Rina, Crossbody Bag Klein",
          rating: 4.3,
          reviewCount: 2156,
          currency: "€",
          price: "34.99",
          listingDate: "2024/04/05",
          salesRank: 267,
          salesRankLast30Days: "#2,789",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B08STU901",
          image: "https://m.media-amazon.com/images/I/71stu901uv.jpg",
          title: "Aucuu Waterproof Men's Shoulder Bag, Multi Bag Crossbody",
          rating: 4.3,
          reviewCount: 1124,
          currency: "€",
          price: "13.99",
          listingDate: "2024/12/17",
          salesRank: 312,
          salesRankLast30Days: "#3,234",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Men->Handbags & Shoulder Bags->Shoulder Bags"
        },
        {
          id: "B09VWX234",
          image: "https://m.media-amazon.com/images/I/71vwx234yz.jpg",
          title: "Men's Shoulder Bag Work Bag Black Men's Shoulder Messenger Bag",
          rating: 4.4,
          reviewCount: 834,
          currency: "€",
          price: "24.99",
          listingDate: "2024/01/08",
          salesRank: 289,
          salesRankLast30Days: "#2,987",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Luggage & Travel Gear->Messenger Bags"
        },
        {
          id: "B08ZAB567",
          image: "https://m.media-amazon.com/images/I/71zab567cd.jpg",
          title: "Gabor Damen Umhängetasche Mina, Crossbody Bag mit Reißverschluss",
          rating: 4.5,
          reviewCount: 1456,
          currency: "€",
          price: "49.99",
          listingDate: "2024/05/22",
          salesRank: 198,
          salesRankLast30Days: "#1,567",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B07CDE890",
          image: "https://m.media-amazon.com/images/I/71cde890ef.jpg",
          title: "s.Oliver Umhängetasche Damen Kunstleder Schultertasche Klein",
          rating: 4.2,
          reviewCount: 1834,
          currency: "€",
          price: "29.99",
          listingDate: "2024/02/18",
          salesRank: 345,
          salesRankLast30Days: "#3,567",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B09EFG123",
          image: "https://m.media-amazon.com/images/I/71efg123hi.jpg",
          title: "Tamaris Damen Umhängetasche Anastasia, Crossbody Bag Mittel",
          rating: 4.6,
          reviewCount: 1678,
          currency: "€",
          price: "39.99",
          listingDate: "2023/12/05",
          salesRank: 223,
          salesRankLast30Days: "#2,234",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B08HIJ456",
          image: "https://m.media-amazon.com/images/I/71hij456jk.jpg",
          title: "Guess Damen Umhängetasche Noelle Mini Crossbody Bag",
          rating: 4.8,
          reviewCount: 723,
          currency: "€",
          price: "79.99",
          listingDate: "2024/04/12",
          salesRank: 167,
          salesRankLast30Days: "#1,345",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B09KLM789",
          image: "https://m.media-amazon.com/images/I/71klm789no.jpg",
          title: "Mini Crossbody Bag for Women Cell Phone Purse Small Shoulder Bag",
          rating: 4.1,
          reviewCount: 945,
          currency: "€",
          price: "15.99",
          listingDate: "2024/06/08",
          salesRank: 456,
          salesRankLast30Days: "#4,567",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B07NOP012",
          image: "https://m.media-amazon.com/images/I/71nop012pq.jpg",
          title: "Crossbody Bag Women Small Leather Shoulder Bag with Adjustable Strap",
          rating: 4.4,
          reviewCount: 1289,
          currency: "€",
          price: "19.99",
          listingDate: "2024/03/25",
          salesRank: 378,
          salesRankLast30Days: "#3,890",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        },
        {
          id: "B08QRS345",
          image: "https://m.media-amazon.com/images/I/71qrs345tu.jpg",
          title: "Michael Kors Damen Jet Set Travel Umhängetasche Crossbody",
          rating: 4.9,
          reviewCount: 567,
          currency: "€",
          price: "129.99",
          listingDate: "2023/10/15",
          salesRank: 98,
          salesRankLast30Days: "#789",
          country: "DE",
          platform: "Amazon",
          category: "Fashion->Women->Handbags & Shoulder Bags->Cross-Body Bags"
        }
      ],
      statistics: {
        total_products: 15,
        avg_price: "€35.67",
        avg_rating: 4.4,
        chinese_seller_ratio: "64.8%"
      },
      insights: [
        "市场竞争激烈，中国卖家占比超过60%",
        "价格集中在€20-€40区间，占比约58%",
        "高评分产品(4.5+)占比约47%，存在质量提升空间",
        "头部品牌（Fossil、Guess、Michael Kors）占据高端市场，但中端市场较为分散"
      ]
    }
  };
};

export const generateMockReportResponse = (taskId: string): AgentResponse => {
  return {
    task_id: taskId,
    status: "completed",
    execution_time: "4.5s",
    result: {
      summary: "德国亚马逊邮差包市场整体已是竞争激烈的红海，通用词汇竞争力极强且中国卖家占比高达64.8%。真正的机会在于两个高潜力细分赛道：一是女士斜挎包，该市场供给适中，品类集中度合理，消费者对新设计接受度高，月销量约3.5万件，是当前最值得切入点；二是男士笔记本邮差包，此类赛道竞争强度较低，中国卖家占比仅45%，存在结构性机会。建议优先布局女士斜挎包市场，通过在材质（420D尼龙+防水涂层）、功能（多隔层设计）和设计（简约时尚风格）上做出差异化，定价在€25-€35区间，快速抢占市场份额。",
      market_overview: {
        title: "一、宏观市场概览",
        content: "德国亚马逊的邮差包市场整体呈现大而散的格局，以核心关键词 umhängetasche (邮差包) 为例，其月销量高达5万件，市场需求旺盛。活跃商品数达2.2万，供给充足但竞争激烈。中国卖家占比超过60%，表明这是一个成熟的跨境电商市场。消费者主要需求集中在日常通勤、休闲出行场景，对产品的材质、容量、便携性有较高要求。头部品牌如Fossil、Guess、Michael Kors占据高端市场（€80+），但中端市场（€20-€50）较为分散，新品牌有机会通过差异化设计和性价比优势切入。",
        metrics: {
          monthly_sales: "5万+",
          active_products: "2.2万",
          chinese_seller_ratio: "64.8%"
        }
      },
      segment_analysis: {
        title: "二、细分赛道与机会地图",
        segments: [
          {
            name: "女士斜挎包（日常通勤款）",
            opportunity: "⭐⭐⭐⭐⭐",
            description: "市场体量大且对新品友好，月销量约3.5万件，活跃商品数1.2万。品类集中度合理，头部品牌市场份额不超过30%，新品有充足的成长空间。消费者对新设计接受度高，主要痛点集中在材质耐用性（评论中频繁提及）和容量实用性。价格敏感度中等，€25-€35为最佳价格区间，占比约58%。建议产品定位：轻量化、多功能的日常通勤包，主打420D尼龙材质+防水涂层，设计多隔层结构（手机、钱包、钥匙分区），简约时尚风格。",
            avg_price: "€25-€35",
            competition: "中等"
          },
          {
            name: "男士笔记本邮差包（商务款）",
            opportunity: "⭐⭐⭐⭐",
            description: "竞争强度较低，月销量约1.8万件，活跃商品数仅6000+。中国卖家占比仅45%，远低于整体市场水平，存在结构性机会。消费者主要为商务人士和学生群体，对产品的专业性和品质感要求较高。主要痛点：笔记本保护性不足、肩带舒适度差。价格敏感度低，€40-€60为主流价格区间。建议产品定位：专业商务邮差包，支持13-15寸笔记本，加厚内胆保护，人体工学肩带设计，商务简约风格。",
            avg_price: "€40-€60",
            competition: "低"
          },
          {
            name: "迷你斜挎包（手机包）",
            opportunity: "⭐⭐⭐",
            description: "新兴细分市场，月销量约1.2万件，增长迅速。主要面向年轻女性群体（18-30岁），用于短途出行、逛街购物场景。市场竞争激烈，中国卖家占比高达75%，价格战明显。主要痛点：设计同质化严重、质量参差不齐。价格敏感度高，€15-€25为主流价格区间。建议谨慎进入，除非有独特的设计创新或品牌溢价能力。",
            avg_price: "€15-€25",
            competition: "高"
          }
        ]
      },
      keyword_insights: {
        title: "三、关键词洞察",
        top_keywords: [
          { keyword: "umhängetasche damen", rank: 1179, opportunity: "高" },
          { keyword: "umhängetasche", rank: 11010, opportunity: "高" },
          { keyword: "crossbody bag", rank: 38812, opportunity: "中" }
        ]
      },
      product_insights: {
        title: "四、竞品分析",
        top_products: 15,
        avg_price: "€35.67",
        key_findings: [
          "头部品牌集中度较低，前10名品牌市场份额合计不超过35%，新品有机会突围",
          "用户痛点集中在材质和耐用性，评论中频繁提及'拉链质量差'、'肩带易断'等问题",
          "价格敏感度中等，€25-€40为最佳价格区间，占比约58%，高于此区间转化率明显下降",
          "高评分产品（4.5+）占比仅47%，存在质量提升空间，消费者对高品质产品有明确需求",
          "产品图片和视频质量参差不齐，优质的场景化展示能显著提升转化率"
        ]
      },
      recommendations: {
        title: "五、行动建议",
        actions: [
          {
            priority: "高",
            action: "优先布局女士斜挎包市场（日常通勤款）",
            details: "产品定位：轻量化、多功能的日常通勤包，目标人群为25-40岁职场女性。差异化策略：使用420D尼龙材质+防水涂层，设计多隔层结构（手机、钱包、钥匙、化妆品分区），加入可调节肩带和隐藏式防盗口袋。价格策略：定价€28-€32，避开低价红海竞争。营销重点：突出材质耐用性和实用性，通过场景化图片和视频展示日常使用场景。"
          },
          {
            priority: "高",
            action: "关注材质和功能差异化，解决用户核心痛点",
            details: "材质升级：使用420D尼龙或帆布材质，增加防水涂层（IPX4级别），确保日常防泼溅。功能创新：设计多隔层结构，主仓+前袋+侧袋，满足不同物品收纳需求；加入USB充电口设计（可选）。质量把控：重点关注拉链和肩带质量，使用YKK拉链，加宽加厚肩带，提升耐用性。通过解决用户痛点，提升产品评分至4.5+，形成口碑传播。"
          },
          {
            priority: "高",
            action: "优化产品图片和视频，提升转化率",
            details: "主图策略：使用纯白背景+45度角展示，突出产品细节和质感。场景图：展示日常通勤、咖啡厅、购物等使用场景，增强代入感。细节图：展示拉链、肩带、内部结构等关键细节，打消用户疑虑。视频内容：30-60秒短视频，展示容量测试（能装多少物品）、防水测试、肩带调节等功能演示。通过优质的视觉内容，将转化率提升至行业平均水平以上。"
          },
          {
            priority: "中",
            action: "价格定位在€25-€35区间，平衡利润和市场竞争力",
            details: "定价策略：首发价€28-€32，避开€20以下的低价红海竞争，也不要定价过高（€40+）影响转化率。促销策略：上架初期可设置限时折扣（如首月8折），快速积累评论和销量。成本控制：通过优化供应链和物流，确保在此价格区间下仍有30%+的毛利率。价格调整：根据市场反馈和竞品动态，灵活调整价格，保持竞争力。"
          },
          {
            priority: "中",
            action: "建立评论管理体系，快速积累高质量评论",
            details: "早期评论：通过Amazon Vine计划或早期评论者计划，快速获得首批评论（目标30+条）。质量把控：确保产品质量，减少差评率，目标评分4.5+。售后服务：建立快速响应的客服体系，及时处理用户问题和投诉，将潜在差评转化为好评。评论引导：在包装中加入感谢卡，引导满意客户留下评论，但不要违反Amazon政策。通过评论管理，建立产品信任度，提升转化率。"
          },
          {
            priority: "低",
            action: "关注季节性趋势，提前布局旺季库存",
            details: "旺季分析：根据趋势数据，邮差包市场在9-12月（返校季+圣诞季）和3-5月（春季出游）有明显销量增长。库存规划：提前2-3个月备货，确保旺季有充足库存，避免断货影响排名。营销配合：在旺季前1个月加大广告投放，提升产品曝光度。新品上架：建议在7-8月上架新品，有充足时间积累评论和优化listing，为旺季做好准备。"
          }
        ]
      }
    }
  };
};
