import { Button, Modal, List, Tag, message, Popconfirm } from 'antd'
import { ApiService } from '../../services/api.service'
import { useEffect, useState } from 'react'
import moment from 'moment'
import 'moment/locale/ru'

const apiService = new ApiService()

function Applications(props) {
    const isUserOrg = props.currentUserInfo.role === 'org'
    const isUserVol = props.currentUserInfo.role === 'vol'

    const [applications, setApplications] = useState([])
    const [volunteerModalVisible, setVolunteerModalVisible] = useState(false)
    const [selectedVolunteer, setSelectedVolunteer] = useState({})
    const [eventModalVisible, setEventModalVisible] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState({})

    function fetchApplications() {
        const url = isUserOrg ? '/applications' : `/volunteer/${props.currentUserInfo.id}/applications`
        apiService.get(url).then(res => {
            setApplications(res)
        }).catch(() => {
            message.error('Не удалось получить список заявок')
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

    function showEventModal(event) {
        setSelectedEvent(event);
        setEventModalVisible(true);
    }

    function closeEventModal() {
        setSelectedEvent({});
        setEventModalVisible(false);
    }

    function changeApplicationStatus(applicationId, statusId) {
        apiService.post(`/application/${applicationId}/status`, { statusId }).then(() => {
            fetchApplications()
            message.success('Статус заявки обновлен')
        }).catch(() => {
            message.error('Не удалось обновить статус заявки')
        })
    }

    function cancelApplication(applicationId) {
        apiService.post(`/application/${applicationId}/cancel`).then(() => {
            fetchApplications()
            message.success('Заявка отменена')
        }).catch(() => {
            message.error('Не удалось отменить заявку')
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

    useEffect(() => {
        fetchApplications()
    }, [])

    const getStatusTag = (status) => {
        switch (status) {
            case 'на рассмотрении':
                return <Tag color="warning">{status}</Tag>
            case 'одобрена':
                return <Tag color="success">{status}</Tag>
            case 'отклонена':
                return <Tag color="error">{status}</Tag>
            default:
                return status
        }
    }

    return (
        <>
            {isUserOrg && (
                <List
                    itemLayout="horizontal"
                    dataSource={applications}
                    renderItem={application => (
                        <List.Item
                            actions={[
                                <Button
                                    type="link"
                                    disabled={application.status === 'одобрена'}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        changeApplicationStatus(application.application_id, 3)
                                    }}
                                >
                                    Одобрить
                                </Button>,
                                <Button
                                    type="link"
                                    disabled={application.status === 'отклонена'}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        changeApplicationStatus(application.application_id, 2)
                                    }}
                                >
                                    Отклонить
                                </Button>
                            ]}
                            onClick={() => showVolunteerModal(application)}
                        >
                            <List.Item.Meta
                                title={`${application.last_name} ${application.first_name} ${application.patronymic}`}
                                description={
                                    <>
                                        <div>Дата рождения: {moment(application.date_of_birth).format('DD.MM.YYYY')} | Телефон: {application.phone_number}</div>
                                        <div>{application.title}</div>
                                        <div>Участвующих волонтеров: {application.current_volunteers}/{application.num_volunteers}</div>
                                    </>
                                }
                            />
                            <div style={{ width: 130, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '60px' }}>
                            {/* % подходимости волонтёра к этому мероприятию */}
                            {application.score != null && (
                                <Tag
                                    color={application.score >= 70 ? 'success' : 'default'}
                                    style={{ fontSize: '16px'}}
                                >
                                    {`${Math.round(application.score)}%`}
                                </Tag>
                            )}
                            {getStatusTag(application.status)}
                            </div>
                        </List.Item>
                    )}
                />
            )}
            {isUserVol && (
                <List
                    itemLayout="horizontal"
                    dataSource={applications}
                    renderItem={application => (
                        <List.Item
                            actions={[
                                <Popconfirm
                                    title="Вы уверены, что хотите отменить заявку?"
                                    onConfirm={(e) => {
                                        e.stopPropagation();
                                        cancelApplication(application.application_id);
                                    }}
                                    okText="Да"
                                    cancelText="Нет"
                                    disabled={application.status === 'отклонена'}
                                >
                                    <Button
                                        type="link"
                                        disabled={application.status === 'отклонена'}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Отменить
                                    </Button>
                                </Popconfirm>
                            ]}
                            onClick={() => showEventModal(application)}
                        >
                            <List.Item.Meta
                                title={application.event_title}
                                description={
                                    <>
                                        <div>{application.categories.join(', ')}</div>
                                        <div>{formatEventPeriod(application.start_date_time, application.end_date_time)}</div>
                                    </>
                                }
                            />
                            {/* % подходимости */}
                            {application.score != null && (
                                <Tag
                                    color={application.score >= 70 ? 'success' : 'default'}
                                    style={{ fontSize: '16px', marginRight: '470px' }}
                                >
                                    {`${Math.round(application.score)}%`}
                                </Tag>
                            )}
                            {getStatusTag(application.status)}
                        </List.Item>
                    )}
                />
            )}
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
                <p><strong>Навыки:</strong> {selectedVolunteer.skills ? selectedVolunteer.skills.join(', ') : '—'}</p>
                <p><strong>Кол-во посещенных мероприятий:</strong> {selectedVolunteer.num_attended_events}</p>
                <p><strong>Часы волонтерства:</strong> {selectedVolunteer.volunteer_hours}</p>
            </Modal>
            <Modal
                title={selectedEvent.event_title}
                open={eventModalVisible}
                onCancel={() => closeEventModal()}
                footer={[
                    <Button onClick={() => closeEventModal()}>Закрыть</Button>
                ]}
            >
                {selectedEvent.image_path ? (
                    <div style={{display: 'flex', justifyContent: 'center', flexWrap: 'wrap'}}>
                        <img alt="Vol Image" src={selectedEvent.image_path}
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
                <p><strong>Описание:</strong> {selectedEvent.description}</p>
                <p><strong>Категории:</strong> {selectedEvent.categories ? selectedEvent.categories.join(', ') : 'Нет'}</p>
                <p><strong>Период проведения:</strong> {formatEventPeriod(selectedEvent.start_date_time, selectedEvent.end_date_time)}</p>
                <p><strong>Кол-во волонтеров:</strong> {selectedEvent.num_volunteers}</p>
                <p><strong>Задачи волонтеров:</strong> {selectedEvent.tasks_volunteers}</p>
                <p><strong>Условия:</strong> {selectedEvent.conditions}</p>
            </Modal>
        </>
    )
}

export default Applications