import { useEffect, useState } from 'react';
import {
  Accordion,
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Group,
  MantineProvider,
  NavLink,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title
} from '@mantine/core';
import {
  IconCheck,
  IconChecklist,
  IconCards,
  IconChartDonut3,
  IconRefresh,
  IconSearch
} from '@tabler/icons-react';
import studyData from './data/studyData.json';
import processTrainingData from './data/processTrainingData.json';
import dataManifest from './data/dataManifest.json';
import './App.css';
import { getProcessGroup } from './lib/processGroups';

const STORAGE_KEYS = {
  theme: 'makeit-vite-theme',
  theoryMastered: 'makeit-vite-theory-mastered',
  theoryNotes: 'makeit-vite-theory-notes',
  theoryNotesVisible: 'makeit-vite-notes-visible'
};

const theoryMethods = ['章节刷题', '优先级筛选', '备注复盘', '掌握度追踪'];
const processMethods = ['纯背诵', '过程->定义/输出', '定义->过程', '输出->过程'];

const processModeOptions = [
  { label: '纯背诵', value: 'recite' },
  { label: '过程 -> 定义/输出', value: 'process_to_answer' },
  { label: '定义 -> 过程', value: 'definition_to_process' },
  { label: '输出 -> 过程', value: 'output_to_process' }
];

const processOrderOptions = [
  { label: '随机模式', value: 'random' },
  { label: '顺序模式', value: 'sequence' }
];

const moduleOptions = [
  { label: '总览', value: 'dashboard' },
  { label: '理论', value: 'theory' },
  { label: '过程', value: 'process' }
];

const theoryFilterOptions = [
  { label: '全部优先级', value: 'ALL' },
  { label: '🔴 必背', value: '🔴' },
  { label: '🟡 背诵', value: '🟡' },
  { label: '🟢 熟练', value: '🟢' }
];

function createSafeJsonState(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function countMasteredQuestions(chapter, masteredIds) {
  return chapter.questions.filter((question) => masteredIds.includes(question.id)).length;
}

function getTheoryStats(masteredIds) {
  const totalQuestions = studyData.reduce((sum, chapter) => sum + chapter.questions.length, 0);
  const requiredQuestions = studyData.reduce(
    (sum, chapter) => sum + chapter.questions.filter((question) => question.priority === '🔴').length,
    0
  );

  return {
    totalQuestions,
    masteredQuestions: masteredIds.length,
    requiredQuestions,
    chapterCount: studyData.length
  };
}

function groupProcessesByDomain() {
  return processTrainingData.reduce((accumulator, item, index) => {
    const current = accumulator[item.领域] || [];
    current.push({ ...item, index });
    accumulator[item.领域] = current;
    return accumulator;
  }, {});
}

function getProcessPrompt(item, mode) {
  if (mode === 'recite') {
    return {
      eyebrow: '纯背诵',
      title: item.过程,
      body: item.领域
    };
  }

  if (mode === 'definition_to_process') {
    return {
      eyebrow: '根据定义回忆过程',
      title: item.领域,
      body: item.定义
    };
  }

  if (mode === 'output_to_process') {
    return {
      eyebrow: '根据主要输出回忆过程',
      title: item.领域,
      body: item.主要输出
    };
  }

  return {
    eyebrow: '根据过程回忆定义与输出',
    title: item.过程,
    body: item.领域
  };
}

function getProcessAnswer(item, mode) {
  if (mode === 'recite') {
    return {
      definition: item.定义,
      output: item.主要输出,
      effect: item.主要作用
    };
  }

  if (mode === 'definition_to_process') {
    return {
      definition: `过程：${item.过程}`,
      output: item.主要输出,
      effect: item.主要作用
    };
  }

  if (mode === 'output_to_process') {
    return {
      definition: `过程：${item.过程}`,
      output: item.定义,
      effect: item.主要作用
    };
  }

  return {
    definition: item.定义,
    output: item.主要输出,
    effect: item.主要作用
  };
}

function getPriorityColor(priority) {
  if (priority === '🔴') return 'red';
  if (priority === '🟡') return 'yellow';
  return 'green';
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEYS.theme) || 'light');
  const [activeModule, setActiveModule] = useState('dashboard');
  const [theoryActiveChapter, setTheoryActiveChapter] = useState(0);
  const [theoryFilter, setTheoryFilter] = useState('ALL');
  const [theorySearch, setTheorySearch] = useState('');
  const [expandedTheoryIds, setExpandedTheoryIds] = useState([]);
  const [masteredTheoryIds, setMasteredTheoryIds] = useState(() =>
    createSafeJsonState(STORAGE_KEYS.theoryMastered, [])
  );
  const [theoryNotes, setTheoryNotes] = useState(() =>
    createSafeJsonState(STORAGE_KEYS.theoryNotes, {})
  );
  const [notesVisible, setNotesVisible] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.theoryNotesVisible);
    return saved === null ? true : saved === 'true';
  });
  const [processMode, setProcessMode] = useState('recite');
  const [processOrder, setProcessOrder] = useState('random');
  const [processIndex, setProcessIndex] = useState(0);
  const [processAnswerVisible, setProcessAnswerVisible] = useState(true);
  const [processScore, setProcessScore] = useState({ correct: 0, total: 0 });

  const theoryStats = getTheoryStats(masteredTheoryIds);
  const currentChapter = studyData[theoryActiveChapter];
  const groupedProcesses = groupProcessesByDomain();
  const currentProcessItem = processTrainingData[processIndex];
  const currentProcessGroup = getProcessGroup(currentProcessItem.过程);
  const currentProcessPrompt = getProcessPrompt(currentProcessItem, processMode);
  const currentProcessAnswer = getProcessAnswer(currentProcessItem, processMode);
  const processAccuracy =
    processScore.total === 0 ? 0 : Math.round((processScore.correct / processScore.total) * 100);

  const visibleQuestions = currentChapter.questions.filter((question) => {
    const matchesFilter = theoryFilter === 'ALL' || question.priority === theoryFilter;
    const keyword = theorySearch.trim();
    if (!keyword) return matchesFilter;
    const haystack = `${question.title} ${question.content} ${question.hook}`.toLowerCase();
    return matchesFilter && haystack.includes(keyword.toLowerCase());
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theoryMastered, JSON.stringify(masteredTheoryIds));
  }, [masteredTheoryIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theoryNotes, JSON.stringify(theoryNotes));
  }, [theoryNotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theoryNotesVisible, String(notesVisible));
  }, [notesVisible]);

  useEffect(() => {
    window.resetStudyProgress = () => {
      setMasteredTheoryIds([]);
      return '学习进度已重置，备注保持不变。';
    };
    window.studyDataManifest = dataManifest;
  }, []);

  useEffect(() => {
    setExpandedTheoryIds([]);
  }, [theoryActiveChapter, theoryFilter, theorySearch]);

  useEffect(() => {
    setProcessAnswerVisible(processMode === 'recite');
  }, [processMode, processIndex]);

  function toggleTheoryMastery(id) {
    setMasteredTheoryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function handleTheoryNoteChange(id, value) {
    setTheoryNotes((current) => ({
      ...current,
      [id]: value
    }));
  }

  function removeTheoryNote(id) {
    setTheoryNotes((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function goToNextProcess() {
    if (processOrder === 'random') {
      setProcessIndex(Math.floor(Math.random() * processTrainingData.length));
      return;
    }

    setProcessIndex((current) => (current + 1) % processTrainingData.length);
  }

  function goToPreviousProcess() {
    if (processOrder === 'random') {
      setProcessIndex(Math.floor(Math.random() * processTrainingData.length));
      return;
    }

    setProcessIndex((current) =>
      current === 0 ? processTrainingData.length - 1 : current - 1
    );
  }

  function recordProcessResult(correct) {
    setProcessScore((current) => ({
      correct: current.correct + (correct ? 1 : 0),
      total: current.total + 1
    }));
    goToNextProcess();
  }

  const allExpanded =
    visibleQuestions.length > 0 && expandedTheoryIds.length === visibleQuestions.length;

  return (
    <MantineProvider
      forceColorScheme={theme}
      theme={{
        primaryColor: 'teal',
        defaultRadius: 'lg',
        fontFamily: 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif',
        colors: {
          slate: [
            '#f6f8fb',
            '#ebf0f5',
            '#d7e0ea',
            '#b8c6d8',
            '#96acc5',
            '#748dac',
            '#597293',
            '#455a76',
            '#2d3c53',
            '#172231'
          ],
          tealbrand: [
            '#ebfffb',
            '#d4fbf4',
            '#abf1e5',
            '#79e5d4',
            '#4ad6c1',
            '#28c1ad',
            '#159b8a',
            '#127b6e',
            '#135f56',
            '#124c45'
          ]
        }
      }}
    >
      <AppShell header={{ height: 60 }} padding="md" className="app-frame">
        <AppShell.Header px="md">
          <Flex className="top-strip" justify="space-between" align="center" gap="sm">
            <Group gap="sm" className="top-strip-left">
              <SegmentedControl
                size="sm"
                value={activeModule}
                onChange={setActiveModule}
                data={moduleOptions}
              />
              <Badge variant="light" color="gray">
                {dataManifest.studyChapters} 章
              </Badge>
              <Badge variant="light" color="gray">
                {dataManifest.studyQuestions} 题
              </Badge>
              <Badge variant="light" color="gray">
                {dataManifest.processItems} 过程
              </Badge>
            </Group>
            <Group gap="xs" className="top-strip-right">
              {activeModule === 'theory' && (
                <Badge variant="light" color="indigo">
                  {currentChapter.chapter}
                </Badge>
              )}
              {activeModule === 'process' && (
                <>
                  <Badge variant="light" color="gray">
                    {currentProcessItem.领域} / {currentProcessGroup.label}
                  </Badge>
                  <Badge variant="light" color="orange">
                    第 {processIndex + 1} / {processTrainingData.length} 条
                  </Badge>
                </>
              )}
              <Switch
                size="sm"
                checked={!notesVisible}
                onChange={(event) => setNotesVisible(!event.currentTarget.checked)}
                label="无备注"
              />
              <Switch
                size="sm"
                checked={theme === 'dark'}
                onChange={(event) =>
                  setTheme(event.currentTarget.checked ? 'dark' : 'light')
                }
                label="夜间"
              />
            </Group>
          </Flex>
        </AppShell.Header>

        <AppShell.Main>
          {activeModule === 'dashboard' && (
            <ScrollArea className="main-scroll-region" offsetScrollbars>
              <Stack gap="md" pb="md">
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                <Card withBorder radius="xl" padding="xl">
                  <Group justify="space-between" align="flex-start" mb="md">
                    <Box>
                      <Group gap="xs" mb={8}>
                        <IconChecklist size={18} />
                        <Text fw={700}>理论考点模块</Text>
                      </Group>
                      <Text c="dimmed" size="sm">
                        按章节推进、按优先级查漏、结合备注复盘。
                      </Text>
                    </Box>
                    <Button color="teal" onClick={() => setActiveModule('theory')}>进入</Button>
                  </Group>
                  <SimpleGrid cols={2} spacing="sm" mb="lg">
                    <Paper radius="lg" p="md" className="soft-stat-card">
                      <Text size="sm" c="dimmed">
                        章节
                      </Text>
                      <Title order={3}>{theoryStats.chapterCount}</Title>
                    </Paper>
                    <Paper radius="lg" p="md" className="soft-stat-card">
                      <Text size="sm" c="dimmed">
                        已掌握
                      </Text>
                      <Title order={3}>{theoryStats.masteredQuestions}</Title>
                    </Paper>
                  </SimpleGrid>
                  <Group gap="xs">
                    {theoryMethods.map((method) => (
                      <Badge key={method} variant="light" color="teal">
                        {method}
                      </Badge>
                    ))}
                  </Group>
                </Card>

                <Card withBorder radius="xl" padding="xl">
                  <Group justify="space-between" align="flex-start" mb="md">
                    <Box>
                      <Group gap="xs" mb={8}>
                        <IconCards size={18} />
                        <Text fw={700}>过程训练模块</Text>
                      </Group>
                      <Text c="dimmed" size="sm">
                        纯背诵、抽问和过程组联想可以快速切换。
                      </Text>
                    </Box>
                    <Button color="teal" onClick={() => setActiveModule('process')}>
                      进入
                    </Button>
                  </Group>
                  <SimpleGrid cols={2} spacing="sm" mb="lg">
                    <Paper radius="lg" p="md" className="soft-stat-card">
                      <Text size="sm" c="dimmed">
                        训练条目
                      </Text>
                      <Title order={3}>{dataManifest.processItems}</Title>
                    </Paper>
                    <Paper radius="lg" p="md" className="soft-stat-card">
                      <Text size="sm" c="dimmed">
                        正确率
                      </Text>
                      <Title order={3}>{processAccuracy}%</Title>
                    </Paper>
                  </SimpleGrid>
                  <Group gap="xs">
                    {processMethods.map((method) => (
                      <Badge key={method} variant="light" color="teal">
                        {method}
                      </Badge>
                    ))}
                  </Group>
                </Card>
              </SimpleGrid>
              </Stack>
            </ScrollArea>
          )}

          {activeModule === 'theory' && (
            <Grid gutter="md" align="stretch">
              <Grid.Col span={{ base: 12, lg: 3 }}>
                <Paper withBorder radius="xl" p="md" className="module-panel">
                  <Group justify="space-between" mb="sm">
                    <Title order={4}>章节目录</Title>
                    <Badge variant="light">{studyData.length} 章</Badge>
                  </Group>
                  <ScrollArea className="panel-scroll" offsetScrollbars>
                    <Stack gap="xs" pr="xs">
                      {studyData.map((chapter, index) => {
                        const masteredCount = countMasteredQuestions(chapter, masteredTheoryIds);
                        return (
                          <NavLink
                            key={chapter.chapter}
                            active={index === theoryActiveChapter}
                            onClick={() => setTheoryActiveChapter(index)}
                            label={chapter.chapter}
                            description={`${masteredCount}/${chapter.questions.length} 已掌握`}
                          />
                        );
                      })}
                    </Stack>
                  </ScrollArea>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 9 }}>
                <Stack gap="md" className="module-column">
                  <Paper withBorder radius="xl" p="lg">
                    <Grid gutter="sm">
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <TextInput
                          value={theorySearch}
                          onChange={(event) => setTheorySearch(event.currentTarget.value)}
                          placeholder="搜索题干、内容、口诀"
                          leftSection={<IconSearch size={16} />}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 3 }}>
                        <Select
                          data={theoryFilterOptions}
                          value={theoryFilter}
                          onChange={(value) => setTheoryFilter(value || 'ALL')}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, md: 1.5 }}>
                        <Button
                          variant="light"
                          fullWidth
                          onClick={() =>
                            setExpandedTheoryIds(
                              allExpanded ? [] : visibleQuestions.map((question) => question.id)
                            )
                          }
                        >
                          {allExpanded ? '收起' : '展开'}
                        </Button>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, md: 1.5 }}>
                        <Button
                          variant="light"
                          color="red"
                          fullWidth
                          leftSection={<IconRefresh size={16} />}
                          onClick={() => setMasteredTheoryIds([])}
                        >
                          重置
                        </Button>
                      </Grid.Col>
                    </Grid>
                  </Paper>

                  <Paper withBorder radius="xl" p="xs" className="questions-panel">
                    <ScrollArea className="questions-scroll" offsetScrollbars>
                      {visibleQuestions.length === 0 ? (
                        <Box p="xl">
                          <Text c="dimmed" ta="center">
                            当前筛选条件下没有找到匹配题目。
                          </Text>
                        </Box>
                      ) : (
                        <Accordion
                          multiple
                          radius="md"
                          variant="separated"
                          value={expandedTheoryIds}
                          onChange={setExpandedTheoryIds}
                        >
                          {visibleQuestions.map((question) => {
                            const mastered = masteredTheoryIds.includes(question.id);
                          return (
                            <Accordion.Item key={question.id} value={question.id}>
                              <Accordion.Control>
                                <Group justify="space-between" wrap="nowrap" pr="sm">
                                  <Group gap="sm" wrap="nowrap">
                                      <Badge color={getPriorityColor(question.priority)} variant="light">
                                        {question.priority}
                                      </Badge>
                                      <Box>
                                        <Text fw={600}>{question.title}</Text>
                                      </Box>
                                    </Group>
                                  <Button
                                    size="xs"
                                    radius="xl"
                                    variant={mastered ? 'filled' : 'light'}
                                    color={mastered ? 'teal' : 'gray'}
                                    leftSection={mastered ? <IconCheck size={14} /> : null}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      toggleTheoryMastery(question.id);
                                    }}
                                  >
                                    {mastered ? '已掌握' : '标记掌握'}
                                  </Button>
                                </Group>
                              </Accordion.Control>
                                <Accordion.Panel>
                                  <Stack gap="md">
                                    <Box
                                      className="question-answer"
                                      dangerouslySetInnerHTML={{ __html: question.content }}
                                    />
                                    {question.hook && (
                                      <Paper radius="lg" p="md" className="hook-card">
                                        <Text size="xs" fw={700} className="hook-label">
                                          记忆口诀
                                        </Text>
                                        <Text fw={700} mt={6} className="hook-text">
                                          {question.hook}
                                        </Text>
                                      </Paper>
                                    )}
                                    <Button
                                      w="fit-content"
                                      variant={mastered ? 'light' : 'filled'}
                                      color={mastered ? 'gray' : 'teal'}
                                      leftSection={mastered ? null : <IconCheck size={16} />}
                                      onClick={() => toggleTheoryMastery(question.id)}
                                    >
                                      {mastered ? '取消掌握' : '标为已掌握'}
                                    </Button>

                                    {notesVisible && (
                                      <Paper withBorder radius="lg" p="md" className="note-card">
                                        <Group justify="space-between" mb="xs">
                                          <Text fw={600}>我的备注</Text>
                                          <Button
                                            variant="subtle"
                                            color="gray"
                                            onClick={() => removeTheoryNote(question.id)}
                                          >
                                            移除备注
                                          </Button>
                                        </Group>
                                        <Textarea
                                          minRows={4}
                                          value={theoryNotes[question.id] || ''}
                                          onChange={(event) =>
                                            handleTheoryNoteChange(question.id, event.currentTarget.value)
                                          }
                                          placeholder="记录易错点、自己的记忆钩子、答题措辞。"
                                        />
                                      </Paper>
                                    )}
                                  </Stack>
                                </Accordion.Panel>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      )}
                    </ScrollArea>
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>
          )}

          {activeModule === 'process' && (
            <Grid gutter="md" align="stretch">
              <Grid.Col span={{ base: 12, lg: 3 }}>
                <Paper withBorder radius="xl" p="md" className="module-panel">
                  <Group justify="space-between" mb="sm">
                    <Group gap="xs">
                      <Title order={4}>过程目录</Title>
                      <Badge variant="light">{processTrainingData.length} 条</Badge>
                    </Group>
                  </Group>
                  <ScrollArea className="panel-scroll" offsetScrollbars>
                    <Stack gap="md" pr="xs">
                      {Object.entries(groupedProcesses).map(([domain, items]) => (
                        <Box key={domain}>
                          <Text fw={700} mb="xs">
                            {domain}
                          </Text>
                          <Stack gap={6}>
                            {items.map((item) => {
                              const group = getProcessGroup(item.过程);
                              return (
                                <NavLink
                                  key={`${domain}-${item.过程}`}
                                  active={item.index === processIndex}
                                  onClick={() => setProcessIndex(item.index)}
                                  label={item.过程}
                                  rightSection={
                                    <Badge
                                      size="sm"
                                      variant="filled"
                                      style={{ backgroundColor: group.color }}
                                    >
                                      {group.label}
                                    </Badge>
                                  }
                                />
                              );
                            })}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </ScrollArea>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 9 }}>
                <Stack gap="md">
                  <Paper withBorder radius="xl" p="md">
                    <Flex className="process-toolbar" justify="space-between" align="center" gap="sm">
                      <SegmentedControl
                        size="sm"
                        value={processMode}
                        onChange={setProcessMode}
                        data={processModeOptions}
                        className="process-toolbar-control"
                        color="teal"
                      />
                      <SegmentedControl
                        size="sm"
                        color="teal"
                        value={processOrder}
                        onChange={setProcessOrder}
                        data={processOrderOptions}
                        className="process-toolbar-order"
                      />
                      <Paper radius="lg" px="md" py="xs" className="soft-stat-card">
                        <Text size="xs" c="dimmed">
                          本轮正确率
                        </Text>
                        <Text fw={700} size="lg">
                          {processAccuracy}%
                        </Text>
                      </Paper>
                    </Flex>
                  </Paper>

                  <Card withBorder radius="xl" padding="xl" className="training-main-card">
                    <Group justify="space-between" mb="lg" align="flex-start">
                      <Group gap="xs">
                        <Badge variant="light" color="gray">
                          {currentProcessItem.领域}
                        </Badge>
                        <Badge
                          variant="filled"
                          style={{ backgroundColor: currentProcessGroup.color }}
                        >
                          {currentProcessGroup.label}过程组
                        </Badge>
                      </Group>
                      <Text c="dimmed" fw={600}>
                        第 {processIndex + 1} / {processTrainingData.length} 条
                      </Text>
                    </Group>

                    <Text size="sm" c="orange.7" fw={700} mb={8}>
                      {currentProcessPrompt.eyebrow}
                    </Text>
                    <Title order={1} mb="xs">
                      {currentProcessPrompt.title}
                    </Title>
                    <Text c="dimmed" className="prompt-copy">
                      {currentProcessPrompt.body}
                    </Text>

                    {processAnswerVisible && (
                      <Paper withBorder radius="lg" p="lg" mt="lg">
                        <Stack gap="sm">
                          <Text>
                            <Text component="span" fw={700}>
                              定义：
                            </Text>{' '}
                            {currentProcessAnswer.definition}
                          </Text>
                          <Text>
                            <Text component="span" fw={700}>
                              主要输出：
                            </Text>{' '}
                            {currentProcessAnswer.output}
                          </Text>
                          <Text>
                            <Text component="span" fw={700}>
                              主要作用：
                            </Text>{' '}
                            {currentProcessAnswer.effect}
                          </Text>
                        </Stack>
                      </Paper>
                    )}

                    <Group mt="xl">
                      {processMode !== 'recite' && !processAnswerVisible && (
                        <Button onClick={() => setProcessAnswerVisible(true)}>想好了，显示答案</Button>
                      )}
                      {processMode !== 'recite' && processAnswerVisible && (
                        <>
                          <Button variant="light" onClick={() => recordProcessResult(false)}>
                            再练一次
                          </Button>
                          <Button color="teal" onClick={() => recordProcessResult(true)}>
                            记住了
                          </Button>
                        </>
                      )}
                      <Button variant="default" onClick={goToPreviousProcess}>
                        上一题
                      </Button>
                      <Button variant="default" onClick={goToNextProcess}>
                        下一题
                      </Button>
                    </Group>
                  </Card>
                </Stack>
              </Grid.Col>
            </Grid>
          )}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;
