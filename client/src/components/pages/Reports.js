import { Card, Button, Modal, Form, Input, DatePicker } from 'antd'
import moment from 'moment'
import { ApiService } from '../../services/api.service'
import { useEffect, useState } from 'react'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

const apiService = new ApiService()

function Reports(props) {
    const isUserOrg = props.currentUserInfo.role === 'org'

    const [items, setItems] = useState([])
    const [modalVisible, setModalVisible] = useState(false)
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [itemRecord, setItemRecord] = useState({})
    const [form] = Form.useForm();

    function showReport(recId) {
        if (recId) { // с параметром — просмотр (ModalVisible)
            apiService.get('/report/' + recId).then(res => {
                setItemRecord(res)
                setModalVisible(true)
            })
        } else { // без параметра — добавление (EditModalVizible - добавление или редактирование)
            setEditModalVisible(true)
            setItemRecord({ publication_date: moment().format('YYYY-MM-DD'), image_paths: itemRecord.image_paths || [] })
        }
    }

    function saveReport() { // здесь возможно нужно вернуть к своему
        if (itemRecord.id) { // если есть id — редактируем
            apiService.post('/report', itemRecord).then(() => {
                close()
                fetchData()
            })
        } else { // если нет id — создаем (передаем id того, кто создал)
            apiService.post('/report', { ...itemRecord, organizer_id: props.currentUserInfo.id }).then(() => {
                close()
                fetchData()
            })
        }
    }

    function removeReport(recId) {
        apiService.delete('/report/' + recId).then(() => {
            close()
            fetchData()
        })
    }

    function close() {
        setItemRecord({})
        setModalVisible(false)
        setEditModalVisible(false)
    }

    function fetchData() {
        apiService.get('/reports').then(res => {
            setItems(res)
        })
    }

    useEffect(() => {
        form.setFieldsValue({
            image_paths: itemRecord.image_paths || []
        });
    }, [itemRecord])

    useEffect(() => {
        fetchData()
    }, [])
    return (
        <>
            {isUserOrg ? (
                <Button type='primary' onClick={() => showReport()}>
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
                        cover={item.image_paths && item.image_paths.length > 0 ?
                            <img alt="Report" src={item.image_paths[0]}
                                 style={{
                                     maxHeight: '280px',
                                     borderRadius: '10px',
                                     boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                                 }}
                            /> : null}
                        onClick={() => showReport(item.id)} // возможно стоит вызов переделать как в CrudExample
                    >
                        <h3 style={{textAlign: 'center', marginTop: '-15px', marginBottom: '10px', fontSize: '16px'}}
                            className="card-title">{item.title}</h3>
                        <Card.Meta
                            description={`Опубликовано: ${moment(item.publication_date).format('LL')}`}
                        />
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
                    <Button onClick={() => close()}>Закрыть</Button>
                ]}
            >
                {itemRecord.image_paths && itemRecord.image_paths.length > 0 ? (
                    <div style={{display: 'flex', justifyContent: 'center', flexWrap: 'wrap'}}>
                        {itemRecord.image_paths.map((image, index) => (
                            <img key={index} src={image} alt={`Peport Image ${index}`}
                                 style={{width: 'auto', maxHeight: '240px', marginRight: '15px', marginTop: '15px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.4)'}}/>
                        ))}
                    </div>
                ) : (
                    <p>No images available.</p>
                )}
                <p style={{textAlign: 'justify', textJustify: 'inter-word', fontSize: '16px'}}>{itemRecord.text}</p>
            </Modal>
            <Modal
                title={itemRecord.id ? 'Редактирование отчета c id = ' + itemRecord.id : 'Добавление отчета'}
                open={editModalVisible}
                okText='Сохранить'
                cancelText='Отмена'
                onCancel={() => close()}
                centered // мб убрать
                footer={[
                    isUserOrg ? (
                        <Button type='primary' onClick={() => saveReport()} disabled={!itemRecord.event_id || !itemRecord.text}>
                            Сохранить
                        </Button>
                    ) : null,
                    isUserOrg && itemRecord.id ? (
                        <Button danger onClick={() => removeReport(itemRecord.id)}>
                            Удалить
                        </Button>
                    ) : null,
                    <Button onClick={() => close()}>Отмена</Button>
                ]}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="id мероприятия">
                        <Input
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, event_id: v.target.value }
                                })
                            }
                            value={itemRecord.event_id}
                            //onChange={(e) => setItemRecord({ ...itemRecord, event_id: e.target.value })}
                        />
                    </Form.Item>
                    <Form.Item label="Заголовок">
                        <Input
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, title: v.target.value }
                                })
                            }
                            value={itemRecord.title}
                            //onChange={(e) => setItemRecord({ ...itemRecord, title: e.target.value })}
                        />
                    </Form.Item>
                    <Form.Item label="Текст отчета">
                        <Input.TextArea
                            disabled={!isUserOrg}
                            onChange={v =>
                                setItemRecord(prevState => {
                                    return { ...prevState, text: v.target.value }
                                })
                            }
                            rows={7}
                            value={itemRecord.text}
                            //onChange={(e) => setItemRecord({ ...itemRecord, text: e.target.value })}
                        />
                    </Form.Item>
                    <Form.Item label="Дата публикации">
                        <DatePicker // мб onChange изменить
                            value={moment(itemRecord.publication_date)}
                            onChange={(date, dateString) => setItemRecord({ ...itemRecord, publication_date: dateString })}
                        />
                    </Form.Item>
                    <Form.List name="image_paths" initialValue={itemRecord.image_paths || []}>
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map((field, index) => (
                                    <Form.Item
                                        key={field.key}
                                        label={index === 0 ? "URL фотографий" : ""}
                                        required={false}
                                    >
                                        <Form.Item
                                            {...field}
                                            validateTrigger={['onChange', 'onBlur']}
                                            rules={[{ required: true, whitespace: true, message: "Вставьте URL-адрес изображения или удалите это поле." }]}
                                            noStyle
                                        >
                                            <Input
                                                placeholder="введите URL-адрес изображения"
                                                style={{ width: 'calc(100% - 40px)' }}
                                                onChange={(e) => {
                                                    const newImagePaths = [...itemRecord.image_paths];
                                                    newImagePaths[index] = e.target.value;
                                                    setItemRecord(prevState => ({
                                                        ...prevState,
                                                        image_paths: newImagePaths
                                                    }));
                                                }}
                                                value={field.value}
                                            />
                                        </Form.Item>
                                        {fields.length > 1 ? (
                                            <MinusCircleOutlined
                                                className="dynamic-delete-button"
                                                style={{ margin: '0 8px' }}
                                                onClick={() => {
                                                    remove(field.name);
                                                    const newImagePaths = [...itemRecord.image_paths];
                                                    newImagePaths.splice(index, 1);
                                                    setItemRecord(prevState => ({
                                                        ...prevState,
                                                        image_paths: newImagePaths
                                                    }));
                                                }}
                                            />
                                        ) : null}
                                    </Form.Item>
                                ))}
                                <Form.Item>
                                    <Button
                                        type="dashed"
                                        onClick={() => add()}
                                        icon={<PlusOutlined />}
                                    >
                                        Add Photo URL
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </>
    )
}

export default Reports