import { Card, Button, Modal, Form, Input, List, Select, Popconfirm, message, Tag } from 'antd'
import { ApiService } from '../../services/api.service'
import { useEffect, useState } from 'react'
import moment from 'moment'
import 'moment/locale/ru'
import { saveAs } from 'file-saver'

const apiService = new ApiService()

function Events(props) {
    const isUserOrg = props.currentUserInfo.role === 'org'
    const isUserVol = props.currentUserInfo.role === 'vol'

    const [items, setItems] = useState([])
    const [allCategories, setAllCategories] = useState([])
    const [modalVisible, setModalVisible] = useState(false)
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [itemRecord, setItemRecord] = useState({})
    const [volunteers, setVolunteers] = useState([]) // в dataSource участников мероприятия !
    const [allVolunteers, setAllVolunteers] = useState([]) // список волонтеров для доб на мероприятие (в select)
    const [selectedVolunteers, setSelectedVolunteers] = useState([]) // выбранный вол для доб на мероприятие
    const [volunteerModalVisible, setVolunteerModalVisible] = useState(false)
    const [selectedVolunteer, setSelectedVolunteer] = useState({}) // в мод окне просмотра инфы о вол
    const [applicationStatus, setApplicationStatus] = useState(null) // статус заявки волонтера
    const [participationStatus, setParticipationStatus] = useState(null) // статус участия волонтера
    const [eventStatuses, setEventStatuses] = useState({}) // статус заявки волонтера для каждого мероприятия (на карточках)
    //const [form] = Form.useForm();
    moment.locale('ru')

    function showEvent(recId) {
        if (recId) { // с параметром — просмотр (ModalVisible)
            apiService.get('/event/' + recId).then(res => {
                setItemRecord(res)
                setModalVisible(true)
                if (isUserVol) {
                    checkVolunteerParticipation(recId, props.currentUserInfo.id)
                }
            })
        } else { // без параметра — добавление (EditModalVizible - добавление или редактирование)
            setEditModalVisible(true)
            setItemRecord({ start_date_time: moment().format('YYYY-MM-DD HH:mm'), end_date_time: moment().format('YYYY-MM-DD HH:mm'), categories: itemRecord.categories || [] })
        }
    }

    function saveEvent() { // здесь возможно нужно вернуть к своему
        if (itemRecord.id) { // если есть id — редактируем (передаем id того, кто обновил)
            apiService.post('/event', { ...itemRecord, organizer_id: props.currentUserInfo.id }).then(() => {
                close()
                fetchData()
            })
        } else { // если нет id — создаем (передаем id того, кто создал)
            apiService.post('/event', { ...itemRecord, organizer_id: props.currentUserInfo.id }).then(() => {
                close()
                fetchData()
            })
        }
    }

    function removeEvent(recId) {
        apiService.delete('/event/' + recId).then(() => {
            close()
            fetchData()
        })
    }

    function close() {
        setItemRecord({})
        setModalVisible(false)
        setEditModalVisible(false)
        setSelectedVolunteers([])
        setApplicationStatus(null)
        setParticipationStatus(null)
    }

    function fetchData() {
        apiService.get('/events').then(res => {
            setItems(res)
            if (isUserVol) {
                fetchEventStatuses(res)
            }
        })
    }

    function fetchCategories() {
        apiService.get('/categories').then(res => {
            setAllCategories(res)
        })
    }

    function formatEventPeriod(start_date_time, end_date_time) {
        const start = moment(start_date_time)
        const end = moment(end_date_time)

        if (start.isSame(end, 'day')) {
            return `${start.format('D MMMM YYYY')}, ${start.format('HH:mm')} - ${end.format('HH:mm')}`
        } else {
            return `${start.format('D MMMM YYYY')} – ${end.format('D MMMM YYYY')}, ${start.format('HH:mm')} - ${end.format('HH:mm')}`
        }
    }

    function fetchEventVolunteers(eventId) {
        apiService.get(`/event/${eventId}/volunteers`).then(res => {
            setVolunteers(res)
        })
    }

    function fetchAllVolunteers() {
        apiService.get('/volunteers').then(res => {
            // Исключаем волонтеров, которые уже участвуют в мероприятии
            const availableVolunteers = res.filter(volunteer => !volunteers.some(v => v.id === volunteer.id))
            setAllVolunteers(availableVolunteers)
        })
    }

    function addVolunteerToEvent(volunteerIds) {
        apiService.post(`/event/${itemRecord.id}/add-volunteer`, { eventId: itemRecord.id, volunteerIds }).then(() => {
            fetchEventVolunteers(itemRecord.id);
        })
    }

    function removeVolunteerFromEvent(volunteerId) {
        apiService.post(`/event/${itemRecord.id}/remove-volunteer`, { eventId: itemRecord.id, volunteerId }).then(() => {
            fetchEventVolunteers(itemRecord.id)
        })
    }

    function showVolunteerModal(volunteer) {
        setSelectedVolunteer(volunteer)
        setVolunteerModalVisible(true)
    }

    function closeVolunteerModal() {
        setSelectedVolunteer({})
        setVolunteerModalVisible(false)
    }

    function applyForEvent(eventId) {
        apiService.post(`/event/${eventId}/apply`, { volunteerId: props.currentUserInfo.id }).then(() => {
            message.success('Заявка подана!')
            checkVolunteerParticipation(eventId, props.currentUserInfo.id)
            setEventStatuses(prevStatuses => ({ // для отображения на карточке
                ...prevStatuses,
                [eventId]: 'на рассмотрении'
            }))
        }).catch(() => {
            message.error('Не удалось подать заявку')
        })
    }

    function cancelApplication(eventId) {
        apiService.post(`/event/${eventId}/cancel-application`, { volunteerId: props.currentUserInfo.id }).then(() => {
            message.success('Заявка отменена!')
            checkVolunteerParticipation(eventId, props.currentUserInfo.id)
            setApplicationStatus(null)
            setEventStatuses(prevStatuses => ({ // для отображения на карточке
                ...prevStatuses,
                [eventId]: null
            }))
        }).catch(() => {
            message.error('Не удалось отменить заявку')
        })
    }

    function checkVolunteerParticipation(eventId, volunteerId) {
        apiService.get(`/event/${eventId}/participation-status/${volunteerId}`).then(res => {
            if (res.status === 'designated') {
                setParticipationStatus('Назначен организатором')
            } else if (res.status) {
                setApplicationStatus(res.status)
                setParticipationStatus(`Статус заявки: ${res.status}`)
            } else {
                setParticipationStatus('Вы не участвуете в данном мероприятии')
            }
        })
    }

    const getStatusTag = (status) => {
        switch (status) {
            case 'Статус заявки: на рассмотрении':
                return <Tag color="warning" style={{ fontSize: '16px' }}>{status}</Tag>
            case 'Статус заявки: одобрена':
                return <Tag color="success" style={{ fontSize: '16px' }}>{status}</Tag>
            case 'Статус заявки: отклонена':
                return <Tag color="error" style={{ fontSize: '16px' }}> {status}</Tag>
            default:
                return status
        }
    }

    function fetchEventStatuses(events) {
        events.forEach(event => {
            apiService.get(`/event/${event.id}/participation-status/${props.currentUserInfo.id}`).then(res => {
                setEventStatuses(prevStatuses => ({
                    ...prevStatuses,
                    [event.id]: res.status
                }))
            })
        })
    }

    function generateReport(eventId) {
        fetch(`http://localhost:3001/api/event/${eventId}/report`, {
            method: 'GET',
            credentials: 'include'
        })
            .then(res => res.blob())
            .then(blob => {
                saveAs(blob, `report_${eventId}.pdf`)
            })
            .catch(() => {
                message.error('Не удалось создать отчет')
            })
    }

    useEffect(() => {
        if (itemRecord.id) {
            fetchEventVolunteers(itemRecord.id)
        }
        //fetchAllVolunteers()
    }, [itemRecord])

    useEffect(() => {
        fetchAllVolunteers()
    }, [volunteers])

    useEffect(() => {
        fetchData()
        fetchCategories()
    }, [])
    return (
        <>
            {isUserOrg ? (
                <Button type='primary' onClick={() => showEvent()}>
                    Добавить
                </Button>
            ) : (
                <></>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around'}}>
                {items.map(item => (
                    <Card
                        key={item.id}
                        hoverable
                        style={{width: 500, margin: '16px'}}
                        cover={item.image_path ?
                            <img alt="Event" src={item.image_path}
                                 style={{
                                     maxHeight: '280px',
                                     borderRadius: '10px',
                                     boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                                 }}
                            /> : null}
                        onClick={() => showEvent(item.id)} // возможно стоит вызов переделать как в Application
                    >
                        <h3 style={{textAlign: 'center', marginTop: '-15px', marginBottom: '10px', fontSize: '16px'}}
                            className="card-title">{item.title}</h3>
                        <Card.Meta
                            description={
                                <>
                                    <div>{item.categories ? item.categories.join(', ') : null}</div>
                                    <div>{formatEventPeriod(item.start_date_time, item.end_date_time)}</div>
                                </>
                            }
                        />
                        {isUserVol && eventStatuses[item.id] && (
                            <Tag color={
                                eventStatuses[item.id] === 'одобрена' ? 'success' :
                                    eventStatuses[item.id] === 'отклонена' ? 'error' :
                                        eventStatuses[item.id] === 'на рассмотрении' ? 'warning' : 'default'
                            } style={{ position: 'absolute', bottom: '15px', right: '35px', fontSize: '15px' }}>
                                {eventStatuses[item.id] === 'designated' ? 'назначен' : eventStatuses[item.id]}
                            </Tag>
                        )}
                        {isUserOrg && (  // редактировние
                            <div className="edit-button-container">
                                <Button onClick={(e) => {
                                    e.stopPropagation();
                                    setItemRecord(item);
                                    setEditModalVisible(true);
                                }}>
                                    Редактировать
                                </Button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
            <Modal
                title={<div style={{textAlign: 'center', fontSize: '20px'}}>{itemRecord.title}</div>}
                open={modalVisible}
                cancelText='Закрыть'
                onCancel={() => close()}
                centered
                width={850}
                footer={[
                    isUserOrg && (
                        <Button
                            type="primary"
                            onClick={() => generateReport(itemRecord.id)}
                            style={{ marginRight: '10px' }}
                        >
                            Сформировать отчет
                        </Button>
                    ),
                    <Button onClick={() => close()}>Закрыть</Button>
                ]}
            >
                {itemRecord.image_path ? (
                    <div style={{display: 'flex', justifyContent: 'center', flexWrap: 'wrap'}}>
                        <img alt="Event Image" src={itemRecord.image_path}
                             style={{
                                 width: 'auto',
                                 maxHeight: '300px',
                                 borderRadius: '10px',
                                 boxShadow: '0 4px 8px rgba(0,0,0,0.4)'
                             }}/>
                    </div>
                ) : (
                    <p>No images available.</p>
                )}
                <p style={{
                    textAlign: 'justify',
                    textJustify: 'inter-word',
                    fontSize: '17px'
                }}>{itemRecord.description}</p>
                <div style={{fontSize: '16px'}}>
                    <p><strong>Категории:</strong> {itemRecord.categories ? itemRecord.categories.join(', ') : 'Нет'}</p>
                    <p><strong>Период проведения:</strong> {formatEventPeriod(itemRecord.start_date_time, itemRecord.end_date_time)}</p>
                    <p><strong>Кол-во волонтеров:</strong> {itemRecord.num_volunteers}</p>
                    <p><strong>Задачи волонтеров:</strong> {itemRecord.tasks_volunteers}</p>
                    <p><strong>Условия:</strong> {itemRecord.conditions}</p>
                </div>
                    {isUserOrg && (
                        <>
                            <h3>Участники мероприятия</h3>
                            <List
                                itemLayout="horizontal"
                                dataSource={volunteers}
                                renderItem={volunteer => (
                                    <List.Item
                                        actions={[
                                            <Popconfirm
                                                title="Удалить волонтера?"
                                                onConfirm={(e) => {
                                                    e.stopPropagation();
                                                    removeVolunteerFromEvent(volunteer.id);
                                                }}
                                                onCancel={(e) => e.stopPropagation()}
                                            >
                                                <Button type="link" onClick={e => e.stopPropagation()}>Удалить</Button>
                                            </Popconfirm>
                                        ]}
                                        onClick={() => showVolunteerModal(volunteer)}
                                    >
                                        <List.Item.Meta
                                            title={`${volunteer.last_name} ${volunteer.first_name}`}
                                            description={`Дата рождения: ${moment(volunteer.date_of_birth).format('DD.MM.YYYY')}`}
                                        />
                                    </List.Item>
                                )}
                            />
                            <Select
                                mode="multiple"
                                placeholder="Добавить волонтеров"
                                style={{width: '100%'}}
                                onChange={setSelectedVolunteers}
                                value={selectedVolunteers}
                            >
                                {allVolunteers.map(volunteer => (
                                    <Select.Option key={volunteer.id} value={volunteer.id}>
                                        {`${volunteer.last_name} ${volunteer.first_name}`}
                                    </Select.Option>
                                ))}
                            </Select>
                            <Button
                                type="primary"
                                onClick={() => {
                                    //selectedVolunteers.forEach(volunteerId => addVolunteerToEvent(volunteerId));
                                    addVolunteerToEvent(selectedVolunteers);
                                    setSelectedVolunteers([]);
                                }}
                                style={{marginTop: '10px'}}
                            >
                                Добавить волонтеров
                            </Button>
                        </>
                    )}
                    {isUserVol && (
                        <>
                            <h3>Ваш статус участия:</h3>
                            <p style={{fontSize: '16px'}}>{participationStatus ? getStatusTag(participationStatus) : 'вы не участвуете в данном мероприятии'}</p>
                            {applicationStatus === 'на рассмотрении' || applicationStatus === 'одобрена' ? (
                                <Button
                                    danger
                                    onClick={() => cancelApplication(itemRecord.id)}
                                >
                                    Отменить заявку
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    onClick={() => applyForEvent(itemRecord.id)}
                                    disabled={applicationStatus === 'отклонена' || participationStatus === 'Назначен организатором'}
                                >
                                    Подать заявку
                                </Button>
                            )}
                        </>
                    )}
            </Modal>
            <Modal
                title={itemRecord.id ? 'Редактирование мероприятия c id = ' + itemRecord.id : 'Добавление мероприятия'}
                open={editModalVisible}
                okText='Сохранить'
                cancelText='Отмена'
                onCancel={() => close()}
                centered // мб убрать
                footer={[
                    isUserOrg ? (
                        <Button type='primary' onClick={() => saveEvent()} disabled={!itemRecord.title || !itemRecord.description}>
                            Сохранить
                        </Button>
                    ) : null,
                    isUserOrg && itemRecord.id ? (
                        <Button danger onClick={() => removeEvent(itemRecord.id)}>
                            Удалить
                        </Button>
                    ) : null,
                    <Button onClick={() => close()}>Отмена</Button>
                ]}
            >
                <Form layout="vertical">
                    <Form.Item label="Заголовок">
                        <Input
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, title: v.target.value }
                                })
                            }
                            value={itemRecord.title}
                        />
                    </Form.Item>
                    <Form.Item label="Категории">
                        <Select
                            mode="multiple"
                            disabled={!isUserOrg}
                            onChange={value => {
                                setItemRecord(prevState => ({
                                    ...prevState,
                                    categories: value
                                }))
                            }}
                            value={itemRecord.categories}
                        >
                            {allCategories.map(category => (
                                <Select.Option key={category.id} value={category.category}>
                                    {category.category}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item label="Описание">
                        <Input.TextArea
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, description: v.target.value }
                                })
                            }
                            rows={7}
                            value={itemRecord.description}
                        />
                    </Form.Item>
                    <Form.Item label="Дата и время начала">
                        <Input
                            type="datetime-local"
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, start_date_time: v.target.value }
                                })
                            }
                            value={moment(itemRecord.start_date_time).format('YYYY-MM-DD HH:mm')}
                        />
                    </Form.Item>
                    <Form.Item label="Дата и время конца">
                        <Input
                            type="datetime-local"
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, end_date_time: v.target.value }
                                })
                            }
                            value={moment(itemRecord.end_date_time).format('YYYY-MM-DDTHH:mm')}
                        />
                    </Form.Item>
                    <Form.Item label="Кол-во волонтеров">
                        <Input
                            type="number"
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, num_volunteers: v.target.value }
                                })
                            }
                            value={itemRecord.num_volunteers}
                        />
                    </Form.Item>
                    <Form.Item label="Задачи волонтеров">
                        <Input.TextArea
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, tasks_volunteers: v.target.value }
                                })
                            }
                            rows={3}
                            value={itemRecord.tasks_volunteers}
                        />
                    </Form.Item>
                    <Form.Item label="Условия">
                        <Input.TextArea
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, conditions: v.target.value }
                                })
                            }
                            rows={3}
                            value={itemRecord.conditions}
                        />
                    </Form.Item>
                    <Form.Item label="URL изображения">
                        <Input
                            disabled={!isUserOrg}
                            placeholder="вставьте URL-адрес изображения"
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, image_path: v.target.value }
                                })
                            }
                            value={itemRecord.image_path}
                        />
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title={`${selectedVolunteer.last_name} ${selectedVolunteer.first_name} ${selectedVolunteer.patronymic}`}
                open={volunteerModalVisible}
                onCancel={() => closeVolunteerModal()}
                footer={[
                    <Button onClick={() => closeVolunteerModal()}>Закрыть</Button>
                ]}
            >
                {selectedVolunteer.image_path ? (
                    <div style={{display: 'flex', justifyContent: 'center', flexWrap: 'wrap'}}>
                        <img alt="Vol Image" src={selectedVolunteer.image_path}
                             style={{
                                 width: 'auto',
                                 maxHeight: '240px',
                                 marginRight: '15px',
                                 marginTop: '15px',
                                 borderRadius: '10px',
                                 boxShadow: '0 4px 8px rgba(0,0,0,0.4)'
                             }}/>
                    </div>
                ) : (
                    <p>No image.</p>
                )}
                <p><strong>Дата рождения:</strong> {moment(selectedVolunteer.date_of_birth).format('LL')}</p>
                <p><strong>Email:</strong> {selectedVolunteer.email}</p>
                <p><strong>Телефон:</strong> {selectedVolunteer.phone_number}</p>
                <p><strong>Описание:</strong> {selectedVolunteer.description}</p>
                <p><strong>Навыки:</strong> {selectedVolunteer.skills}</p>
                <p><strong>Кол-во посещенных мероприятий:</strong> {selectedVolunteer.num_attended_events}</p>
                <p><strong>Часы волонтерства:</strong> {selectedVolunteer.volunteer_hours}</p>
            </Modal>
        </>
    )
}

export default Events